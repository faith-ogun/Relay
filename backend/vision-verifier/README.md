# vision-verifier

The camera **component inventory check** (#33) — step 2 of Ohmlet's core learning
loop. The learner points their camera at the parts laid out on the bench; this
service confirms the kit against the build's expected parts before wiring starts.

A focused, latency-tuned vision microservice, deployed as its own Cloud Run
service (modular backend design). It uses **Gemini 3.5 Flash** with thinking
disabled and a strict JSON response schema, so a kit check is a fast round trip,
not a slow free-text answer. It shares the same spine as every Ohmlet service:
Firebase-token auth, per-identity rate limiting, circuit breakers with graceful
degradation, and structured-JSON observability with `/internal/metrics`.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET`  | `/health` | – | Liveness probe |
| `POST` | `/v1/verify-inventory` | Bearer | Check a bench photo against a build's expected parts |
| `POST` | `/v1/identify-component` | Bearer | Identify one component held up to the camera |
| `GET`  | `/internal/metrics` | `X-Ohmlet-Metrics-Token` | App metrics (counts, p50/p95, breakers) |

### `POST /v1/verify-inventory`
```jsonc
// request
{
  "image_base64": "<jpeg/png, optionally a data: URL>",
  "expected_parts": ["Arduino Uno", "LDR", "10kΩ resistor", "LED", "Buzzer"],
  "build_title": "Light-Activated Alarm"
}
// response
{
  "parts": [
    { "name": "Arduino Uno", "status": "present", "note": null },
    { "name": "LDR", "status": "present", "note": null },
    { "name": "10kΩ resistor", "status": "unsure", "note": "value can't be read by eye" },
    { "name": "LED", "status": "present", "note": null },
    { "name": "Buzzer", "status": "missing", "note": null }
  ],
  "found_extras": ["jumper wires"],
  "ready": false,
  "feedback": "Almost there — grab a buzzer and you're ready to wire.",
  "confidence": 0.82
}
```
`status` is one of `present | missing | unsure`. `ready` is recomputed
server-side from the per-part statuses, so it can never disagree with them.

## Run locally
```bash
cd backend/vision-verifier
python3 -m venv .venv && source .venv/bin/activate   # Python 3.13
pip install -r requirements.txt
PYTHONPATH=app uvicorn app.main:app --host 0.0.0.0 --port 8084 --reload
```

## Deploy
```bash
./deploy.sh vision-verifier   # from the repo root
```

## Tests
```bash
cd backend/vision-verifier
pip install -r requirements-dev.txt
PYTHONPATH=app pytest
```
