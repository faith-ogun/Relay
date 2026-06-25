"""Input validation for the Arduino compile service (#73, #45).

The payload is C++ source for a sketch. We don't try to "sanitise" the code (the
compiler is the authority on what's valid), but we bound its size so a client
can't post an arbitrarily large body, and we reject obviously empty input. The
real safety comes from the sandboxed, time- and resource-limited compile in
main.py — the source is compiled, never executed, on the server.
"""

from __future__ import annotations

import os

from fastapi import HTTPException

# A real Arduino sketch is a few KB; 64 KB is very generous and still finite.
MAX_SOURCE_BYTES = int(os.getenv("OHMLET_MAX_SKETCH_BYTES", str(64 * 1024)))
ALLOWED_FQBN = {
    s.strip()
    for s in os.getenv("OHMLET_ALLOWED_FQBN", "arduino:avr:uno,arduino:avr:nano").split(",")
    if s.strip()
}
DEFAULT_FQBN = os.getenv("OHMLET_DEFAULT_FQBN", "arduino:avr:uno")


def clean_source(source: object) -> str:
    if not isinstance(source, str) or not source.strip():
        raise HTTPException(status_code=422, detail="source is required.")
    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        raise HTTPException(status_code=413, detail=f"Sketch is too large (max {MAX_SOURCE_BYTES // 1024} KB).")
    return source


def clean_fqbn(fqbn: object) -> str:
    """Only allow a known board target — never let the client pass an arbitrary
    string into the compiler invocation."""
    if fqbn is None:
        return DEFAULT_FQBN
    f = str(fqbn).strip()
    if f not in ALLOWED_FQBN:
        raise HTTPException(status_code=422, detail=f"Unsupported board '{f}'.")
    return f
