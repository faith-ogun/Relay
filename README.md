# Ohmlet

![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Vite](https://img.shields.io/badge/Vite-5-646CFF)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4)
![Three.js](https://img.shields.io/badge/Three.js-r170-000000)
![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688)
![Python](https://img.shields.io/badge/Python-3.13-3776AB)
![Cloud Run](https://img.shields.io/badge/Cloud_Run-Deployed-4285F4)
![Gemini](https://img.shields.io/badge/Gemini-Live_API-8E75B2)
![Firestore](https://img.shields.io/badge/Firestore-Realtime-FFCA28)

**Learn electronics by building, with a live AI tutor that watches your bench.**

Ohmlet is a commercial, real-time multimodal lab tutor for learning electronics, mechatronics, and robotics by building. It uses the Gemini Live API (bidirectional audio + video streaming) to watch a learner's physical workspace — breadboard, Arduino, components — and guide them through builds with voice and vision, correcting mistakes mid-action.

Think **Duolingo / Brilliant / Mimo, but for hands-on electronics**: a friendly mascot (the Ohmlet, an ohm-resistor egg), a gamified learning loop, a real social layer, and a live AI bench tutor that sees and talks.

- **Domain:** [ohmlet.org](https://ohmlet.org)
- **GCP project:** `ohmlet-app`

## The learning loop

1. Pick a build from the library (e.g. Light-Activated Alarm)
2. Show your components, and Ohmlet verifies inventory via camera
3. Wire step by step while Ohmlet guides and corrects in real time
4. Generate and debug the Arduino sketch
5. Run the circuit; Ohmlet validates via serial output and camera
6. Earn XP, keep your streak, and share the build to the community

**No hardware?** Simulation mode lets you learn without an Arduino. Turn on your camera and the tutor works with whatever is in view.

## The product

### Marketing site
- **Landing** — the brand, the pitch, the mascot
- **Learn** — the electronics curriculum: build paths and the topics you master
- **Build** — community builds gallery and learner stories
- **Blog** — plain-English electronics writing (SEO)
- **Pricing** — Free, Pro, and Teams

### App workspace (`/ohmlet-app`)

| Tab | What it does |
|-----|-------------|
| **Build** | Live workspace: camera feed, voice interaction, step-by-step guidance |
| **Learn** | Adaptive quizzes, interactive circuit diagrams, drawing exercises with Gemini Vision assessment, and review history |
| **Sandbox** | 3D breadboard workspace: place components, edit wires, write Arduino in Monaco, run circuit validation and simulation |
| **Community** | Share builds, react, comment |
| **Library** | Starter projects with 3D Twin presets for the sandbox |

### Pricing

| Tier | Price | For |
|------|-------|-----|
| **Free** | $0 | First build path, 30 min/week of live tutor, core lessons |
| **Pro** | $15.99/mo ($11.99 annual) | Unlimited paths, up to 15 hrs/mo live tutor, 3D twins, progress tracking |
| **Teams** | $9.99/seat/mo | Classrooms and cohorts: educator dashboard, rosters, shared libraries |

## Multi-model architecture

One voice session, multiple models working behind the scenes:

| Role | Model |
|------|-------|
| Live tutor (voice + vision) | `gemini-live-2.5-flash-native-audio` |
| Quick checks (component ID) | `gemini-2.5-flash` |
| Code generation (Arduino) | `gemini-2.5-pro` |
| Deep reasoning (debugging) | `gemini-2.5-pro` |
| Drawing assessment (vision) | `gemini-2.5-pro` |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Ohmlet Frontend                      │
│         React + TypeScript + Three.js + Monaco         │
│                                                        │
│  Landing · Learn · Build · Blog · Pricing · /app       │
│                                                        │
│   WebSocket          HTTP            HTTP              │
│       │               │               │               │
└───────┼───────────────┼───────────────┼───────────────┘
        │               │               │
   ┌────▼────┐     ┌─────▼─────┐         │
   │  Live   │     │   Quiz    │         │
   │ Bridge  │     │  Engine   │         │
   │(Cloud   │     │ (Cloud    │         │
   │  Run)   │     │   Run)    │         │
   └────┬────┘     └─────┬─────┘         │
        │                │               │
        │          ┌─────▼──────┐  ┌─────▼──────┐
        │          │  /v1/state │  │  Firestore │
        │          │ (service-  │──│ (ohmlet-   │
        │          │  account)  │  │   app)     │
        │          └────────────┘  └────────────┘
        │
   ┌────▼──────────────────┐
   │   Gemini (Vertex AI)  │
   │  Live audio + Flash   │
   │  + Pro models         │
   └───────────────────────┘
```

Persistence is **backend-mediated**: the browser never touches Firestore directly. It calls `/v1/state/{user}` on the live-bridge service, which reads and writes Firestore with the service account, so Firestore client rules can deny all direct browser access.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Nunito
- **3D:** Three.js via @react-three/fiber + @react-three/drei
- **Code editor:** Monaco Editor
- **Live backend:** FastAPI + Google ADK (bidirectional WebSocket streaming)
- **Quiz backend:** FastAPI + google-genai SDK
- **Persistence:** Firestore (europe-west2), accessed via the backend service account
- **Hosting:** Firebase Hosting (frontend), Cloud Run (services)
- **GCP project:** `ohmlet-app`

## Local development

### Prerequisites
- Node.js 18+
- Python 3.13 (not 3.14 — pydantic-core wheels are missing)
- Google Cloud SDK (for deployment and local Firestore access)

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173  (app workspace at /ohmlet-app)
```

Create `frontend/.env.local`:

```env
VITE_OHMLET_API_BASE_URL=http://localhost:8082
VITE_OHMLET_WS_URL=ws://localhost:8082
VITE_OHMLET_QUIZ_API_BASE_URL=http://localhost:8083
VITE_OHMLET_DEFAULT_USER_ID=faith
VITE_OHMLET_GCP_PROJECT_ID=ohmlet-app
```

### Live bridge backend (port 8082)

```bash
cd backend/live-bridge
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=app uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
```

```env
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=ohmlet-app
GOOGLE_CLOUD_LOCATION=europe-west1
OHMLET_LIVE_MODEL=gemini-live-2.5-flash-native-audio
OHMLET_FLASH_MODEL=gemini-2.5-flash
OHMLET_PRO_MODEL=gemini-2.5-pro
```

Local Firestore access uses Application Default Credentials (`gcloud auth application-default login`).

### Quiz engine backend (port 8083)

```bash
cd backend/quiz-engine
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8083 --reload
```

### Vision-verifier backend (port 8084)

The camera component inventory check (step 2 of the core loop).

```bash
cd backend/vision-verifier
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=app uvicorn app.main:app --host 0.0.0.0 --port 8084 --reload
```

## Deployment

```bash
./deploy.sh                  # all services + frontend build
./deploy.sh live-bridge      # one service
./deploy.sh vision-verifier  # one service
./deploy.sh verify           # health-check deployed services
```

## Observability & alerting

All services emit structured JSON logs with Cloud Trace correlation, expose a
token-guarded `/internal/metrics`, and keep a security audit trail. See
[`ops/observability.md`](ops/observability.md). Provision Cloud Monitoring
alerts (uptime, 5xx rate, latency) with `./ops/alerting.sh`.

On Cloud Run with Vertex AI, no API key is needed — authentication uses the service account automatically.

## Build verification

```bash
cd frontend && npm run build                           # must pass before any merge
python3 -m py_compile backend/live-bridge/app/*.py
python3 -m py_compile backend/quiz-engine/app/*.py
python3 -m py_compile backend/vision-verifier/app/*.py
```

## Gemini API session limits

The Gemini Live API imposes per-session limits: **15 minutes** for audio-only and **2 minutes** with video active. These are hard API limits; ending a session and starting a new one gives fresh limits. The UI surfaces them so users understand disconnections are API-imposed, not bugs.

## Known limitations

- The sandbox validates circuit structure (component presence, wiring, connections) but does not compute voltages/currents like a SPICE simulator
- Drawing assessment is easiest on a touchscreen; trackpad drawing is harder
- Gemini Live video sessions are capped at 2 minutes per the API

## Links

- **Blog:** [I Built a Real-Time AI Lab Partner for Electronics Learning with Gemini Live](https://medium.com/@faith-ogun/i-built-a-real-time-ai-lab-partner-for-electronics-learning-with-gemini-live-8b450a6b4f2a)
- **GDG profile:** [developers.google.com/profile/u/faithogundimu](https://developers.google.com/profile/u/faithogundimu)
