# Ohmlet Compiler (`ohmlet-compiler`)

Compiles a learner's Arduino sketch into firmware (#73). The browser then runs
that firmware cycle-accurately on **AVR8js** (MIT) wired to the circuit
simulator, so "run real Arduino code" is genuinely real — not interpreted.

There is no pure-JS Arduino compiler, so this native build step (arduino-cli +
avr-gcc, baked into the image) is the missing half of real-firmware execution.

## Endpoint

`POST /v1/compile` (Firebase-authed) — `{ "source": "<sketch.ino>", "fqbn"?: "arduino:avr:uno" }`

```json
// success
{ "ok": true, "hex": ":100000...", "text_bytes": 924, "data_bytes": 9, "errors": [] }
// compile error (still HTTP 200 — a successful *service* call)
{ "ok": false, "errors": [{ "line": 7, "message": "'pinMod' was not declared in this scope" }] }
```

`GET /health` — liveness.

## Safety

The source is **compiled, never executed** on the server. The compile still runs:

- behind **Firebase auth + per-identity rate limiting** (the shared `guard`)
- as a **non-root** user, in a **throwaway temp dir**, core baked read-only into the image
- under a hard **wall-clock timeout** (`OHMLET_COMPILE_TIMEOUT_S`, default 25s) **and**
  CPU / address-space / file-size **rlimits** (`_limits` in `main.py`)
- restricted to an **allow-listed board** (no arbitrary FQBN into the toolchain)
- with a **source-size cap** (`OHMLET_MAX_SKETCH_BYTES`, default 64 KB)

Same observability + resilience spine as every other service (structured logs,
token-guarded `/internal/metrics`, audit trail, circuit breaker, scoped CORS).

## Local

```bash
cd backend/compiler
PYTHONPATH=app python3 -m pytest -q          # tests stub the toolchain
# Full run needs arduino-cli + arduino:avr installed (see Dockerfile), then:
PYTHONPATH=app uvicorn app.main:app --port 8084 --reload
```

## Deploy

`./deploy.sh compiler` — Cloud Run, 2Gi / 2 vCPU / 120s (avr-gcc is heavy and the
image carries the AVR core). The frontend reads `VITE_OHMLET_COMPILER_API_BASE_URL`.
