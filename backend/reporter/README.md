# Ohmlet Reporter — 3D digital-twin service (#31)

The final step of the core learning loop: turn a learner's finished, real-world
build into a 3D digital twin they can keep, spin, and share. This is the **one
post-session artifact** Ohmlet produces.

## What it does

1. Accepts the final camera frame of a completed build (base64).
2. Calls a true **image→mesh** 3D-generation provider (see `app/providers.py`) to
   produce a binary glTF (`.glb`).
3. Stores the GLB in Cloud Storage and metadata in Firestore, scoped to the owner.
4. Streams the model back through an authenticated, ownership-checked endpoint.

Generation is gated + metered per plan (the twin is a paid artifact, and each one
is a real generation cost). Same auth + observability + resilience spine as every
Ohmlet service.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/twin` | Generate a twin from `{ image_base64, title?, sessionId?, buildId? }`. Gated by plan quota. |
| GET | `/v1/twins` | The caller's twins, newest first. |
| GET | `/v1/twins/{id}` | One twin's metadata. |
| GET | `/v1/twins/{id}/model` | Stream the GLB mesh (ownership-checked, private). |
| DELETE | `/v1/twins/{id}` | Delete a twin + its mesh. |
| GET | `/health` | Liveness + which provider is configured. |
| GET | `/internal/metrics` | Token-guarded metrics (#35). |

All endpoints except `/health` require a Firebase ID token (`Authorization:
Bearer …`); the UID is derived server-side (#44).

## Providers (true image → mesh)

`app/providers.py` is a thin adapter so the rest of the service is provider-
agnostic. The default targets **Stability AI** image-to-3D (Stable Fast 3D /
SPAR3D), which returns a GLB in one synchronous call. Swap with
`OHMLET_TWIN_PROVIDER`; an async provider (Meshy, Tripo) implements the same
`generate(image) -> glb_bytes` by polling internally.

**No API key configured → the service returns a clean `503`**, never a fake twin.
The key is a real secret, injected from Secret Manager at deploy.

## Configuration

| Env | Default | Notes |
|-----|---------|-------|
| `OHMLET_TWIN_PROVIDER` | `stability` | `none` disables generation |
| `STABILITY_API_KEY` | — | **secret**; from Secret Manager in prod |
| `OHMLET_TWINS_BUCKET` | `ohmlet-app-twins` | GCS bucket for the GLBs |
| `OHMLET_TWINS_COLLECTION` | `ohmlet_twins` | Firestore metadata |
| `OHMLET_TWINS_FREE/PRO/MAX` | `1 / 30 / 100` | monthly quota per plan (tunable policy) |
| `OHMLET_METRICS_TOKEN` | — | guards `/internal/metrics` |

## One-time setup

```bash
# Bucket for the meshes (private; uniform access)
gcloud storage buckets create gs://ohmlet-app-twins \
  --project=ohmlet-app --location=europe-west1 --uniform-bucket-level-access

# Store the provider key as a secret, then reference it at deploy
printf '%s' "$STABILITY_API_KEY" | gcloud secrets create ohmlet-stability-key --data-file=-
```

## Local dev

```bash
python3.13 -m venv .venv && source .venv/bin/activate   # 3.13, not 3.14
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env   # fill STABILITY_API_KEY for live generation
PYTHONPATH=app uvicorn app.main:app --host 0.0.0.0 --port 8085 --reload
python -m pytest      # pure-logic tests; GCS/Firestore paths smoke-tested live
```

## Deploy

```bash
./deploy.sh reporter
```
