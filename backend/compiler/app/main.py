"""Ohmlet Compiler — turn an Arduino sketch into firmware (#73).

The simulator can run *real* Arduino sketches: this service compiles the
learner's C++ with the actual Arduino AVR toolchain (arduino-cli + avr-gcc) and
returns an Intel-HEX image, which the browser then executes cycle-accurately on
AVR8js (MIT) wired to the circuit simulator. There is no pure-JS Arduino
compiler, so this native build step is the missing half of "run real firmware".

Safety: the source is *compiled, never executed* on the server. Even so, an
untrusted compile is a real surface, so it runs:
  • behind Firebase auth + per-identity rate limiting (same guard as every service)
  • in a throwaway temp dir, as a non-root user, with the core baked into the image
  • under a hard wall-clock timeout AND CPU / address-space / file-size rlimits
  • restricted to a known board target (no arbitrary FQBN into the toolchain)

Same resilience + observability spine as the rest of the fleet.
"""

from __future__ import annotations

import logging
import os
import re
import resource
import subprocess
import tempfile
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

import obs
import ratelimit
import validation
from auth import uid_from_bearer
from cors import install_cors
from resilience import CircuitBreaker

logger = logging.getLogger("ohmlet.compiler")

COMPILE_TIMEOUT_S = float(os.getenv("OHMLET_COMPILE_TIMEOUT_S", "25"))
COMPILE_CPU_S = int(os.getenv("OHMLET_COMPILE_CPU_S", "20"))
COMPILE_MEM_MB = int(os.getenv("OHMLET_COMPILE_MEM_MB", "1024"))
ARDUINO_CLI = os.getenv("OHMLET_ARDUINO_CLI", "arduino-cli")

app = FastAPI(title="Ohmlet Compiler", version="0.1.0")
install_cors(app)

# Fail fast if the toolchain is wedged rather than making every learner wait.
_CB = CircuitBreaker("arduino-compile", fail_max=5, reset_timeout=30.0)
obs.metrics.register_breaker("arduino-compile", _CB)


class CompileRequest(BaseModel):
    source: str
    fqbn: Optional[str] = None


class Diagnostic(BaseModel):
    line: Optional[int] = None
    message: str


class CompileResponse(BaseModel):
    ok: bool
    hex: Optional[str] = None
    text_bytes: Optional[int] = None       # program (flash) size
    data_bytes: Optional[int] = None       # static RAM used
    errors: list[Diagnostic] = Field(default_factory=list)


def guard(request: Request, authorization: Optional[str] = Header(default=None)) -> str:
    uid = uid_from_bearer(authorization)
    obs.set_uid(uid)
    ratelimit.enforce_rest(request, uid)
    return uid


def _limits() -> None:
    """Run in the child before exec: cap CPU seconds, address space and file size
    so a pathological sketch (huge templates, runaway codegen) can't exhaust the
    container."""
    resource.setrlimit(resource.RLIMIT_CPU, (COMPILE_CPU_S, COMPILE_CPU_S))
    mem = COMPILE_MEM_MB * 1024 * 1024
    try:
        resource.setrlimit(resource.RLIMIT_AS, (mem, mem))
    except (ValueError, OSError):
        pass
    fsz = 8 * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_FSIZE, (fsz, fsz))


_LINE_RE = re.compile(r":(\d+):\d+:\s*(?:error|fatal error):\s*(.*)$")


def _parse_errors(stderr: str) -> list[Diagnostic]:
    out: list[Diagnostic] = []
    for raw in (stderr or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        m = _LINE_RE.search(line)
        if m:
            out.append(Diagnostic(line=int(m.group(1)), message=m.group(2).strip()[:400]))
        elif "error:" in line.lower():
            out.append(Diagnostic(line=None, message=line.split("error:", 1)[-1].strip()[:400] or line[:400]))
    if not out and stderr.strip():
        out.append(Diagnostic(line=None, message=stderr.strip().splitlines()[-1][:400]))
    return out[:30]


_SIZE_RE = re.compile(r"Sketch uses (\d+) bytes.*?Global variables use (\d+) bytes", re.S)


@app.post("/v1/compile", response_model=CompileResponse)
def compile_sketch(req: CompileRequest, uid: str = Depends(guard)) -> CompileResponse:
    source = validation.clean_source(req.source)
    fqbn = validation.clean_fqbn(req.fqbn)

    if not _CB.allow():
        raise HTTPException(503, "The compiler is busy right now. Please try again in a moment.", headers={"Retry-After": "15"})

    with tempfile.TemporaryDirectory(prefix="ohmlet-sketch-") as work:
        sketch_dir = os.path.join(work, "sketch")
        os.makedirs(sketch_dir)
        with open(os.path.join(sketch_dir, "sketch.ino"), "w", encoding="utf-8") as f:
            f.write(source)
        build_dir = os.path.join(work, "build")

        cmd = [ARDUINO_CLI, "compile", "--fqbn", fqbn, "--build-path", build_dir, "--no-color", sketch_dir]
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=COMPILE_TIMEOUT_S,
                preexec_fn=_limits,
                env=os.environ.copy(),
                cwd=work,
            )
        except subprocess.TimeoutExpired:
            _CB.record_failure()
            obs.metrics.inc("compile_timeouts")
            raise HTTPException(408, "Your sketch took too long to compile. Simplify it and try again.")
        except FileNotFoundError as exc:
            logger.error("arduino-cli not found: %s", exc)
            raise HTTPException(503, "Compiler is not available right now.") from exc

        if proc.returncode != 0:
            _CB.record_success()  # a compile error is a *successful* service call
            obs.metrics.inc("compile_errors")
            return CompileResponse(ok=False, errors=_parse_errors(proc.stderr or proc.stdout))

        hex_path = os.path.join(build_dir, "sketch.ino.hex")
        if not os.path.exists(hex_path):
            _CB.record_failure()
            logger.warning("compile ok but no hex at %s", hex_path)
            raise HTTPException(500, "Compiled, but no firmware was produced.")
        with open(hex_path, "r", encoding="utf-8") as f:
            hex_text = f.read()

        text_bytes = data_bytes = None
        m = _SIZE_RE.search(proc.stdout or "")
        if m:
            text_bytes, data_bytes = int(m.group(1)), int(m.group(2))

        _CB.record_success()
        obs.metrics.inc("compiles_ok")
        obs.audit("compiler.compiled", uid=uid, fqbn=fqbn, flashBytes=text_bytes)
        return CompileResponse(ok=True, hex=hex_text, text_bytes=text_bytes, data_bytes=data_bytes)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "compiler"}


# Observability last so its middleware wraps everything (#35).
obs.install_observability(app, "compiler")
