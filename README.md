# Relay

![React](https://img.shields.io/badge/React-18-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Vite](https://img.shields.io/badge/Vite-5-646CFF)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4)
![Three.js](https://img.shields.io/badge/Three.js-r170-000000)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)
![Python](https://img.shields.io/badge/Python-3.13-3776AB)
![Cloud Run](https://img.shields.io/badge/Cloud_Run-Deployed-4285F4)
![Gemini](https://img.shields.io/badge/Gemini-Live_API-8E75B2)
![Firestore](https://img.shields.io/badge/Firestore-Realtime-FFCA28)
![ADK](https://img.shields.io/badge/ADK-Bidi_Streaming-4285F4)

**A real-time multimodal lab assistant for learning electronics.**

Built for the [Gemini Live Agent Challenge](https://devpost.com/) — **Live Agents** category.

Relay watches your physical workspace through a webcam and guides you through electronics builds with live voice and vision. Instead of reading tutorials, you talk to Relay while it sees your breadboard, components, and wiring — correcting mistakes as they happen.

## How it works

1. Pick a build from the library (e.g. Light-Activated Alarm)
2. Show your components — Relay verifies inventory via camera
3. Wire step-by-step — Relay guides and corrects in real time
4. Generate Arduino code — Relay writes and debugs sketches
5. Run and validate — Relay watches serial output and confirms
6. Get a 3D digital twin of the completed build in the sandbox

**No hardware?** Demo Mode lets judges experience the full live session without an Arduino. Turn on your camera and hold up any object — Relay identifies it in real time.

## What's in the app

| Tab | What it does |
|-----|-------------|
| **Build** | Live workspace — camera feed, voice interaction, step-by-step guidance |
| **Learn** | AI-generated adaptive quizzes, drawing exercises with Gemini Vision assessment, wrong-answer requeue, and review history |
| **Sandbox** | 3D breadboard workspace — place components, edit wires, write Arduino code in Monaco, run circuit validation and simulation with buzzer audio |
| **Community** | Share builds, react, comment — persisted via Firestore |
| **Library** | Starter projects with 3D Twin presets for the sandbox |

## Multi-model architecture

One voice session, multiple models working behind the scenes:

| Role | Model |
|------|-------|
| Live tutor (voice + vision) | `gemini-2.5-flash-native-audio` |
| Quick checks (component ID) | `gemini-3.1-flash-preview` |
| Code generation (Arduino) | `gemini-3.1-pro-preview` |
| Deep reasoning (debugging) | `gemini-2.5-pro` |
| Drawing assessment (vision) | `gemini-3.1-pro-preview` |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Relay Frontend                     │
│        React + TypeScript + Three.js + Monaco        │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐ │
│  │  Build   │ │  Learn   │ │Sandbox │ │ Community  │ │
│  │(Live AI) │ │(Quizzes) │ │  (3D)  │ │  (Feed)   │ │
│  └────┬─────┘ └────┬─────┘ └────────┘ └───────────┘ │
│       │             │                                │
│  WebSocket     HTTP POST          Firestore REST     │
│       │             │                   │            │
└───────┼─────────────┼───────────────────┼────────────┘
        │             │                   │
   ┌────▼────┐   ┌────▼─────┐    ┌───────▼──────┐
   │  Live   │   │  Quiz    │    │   Firestore  │
   │ Bridge  │   │ Engine   │    │  (relay-     │
   │(Cloud   │   │(Cloud    │    │   gemini)    │
   │  Run)   │   │  Run)    │    └──────────────┘
   └────┬────┘   └────┬─────┘
        │              │
   ┌────▼────┐    ┌────▼─────┐
   │  ADK    │    │ Gemini   │
   │  Bidi   │    │ Flash    │
   │Streaming│    │(genai)   │
   └────┬────┘    └──────────┘
        │
   ┌────▼──────────────────┐
   │   Gemini Models       │
   │  (Vertex AI)          │
   │                       │
   │  • Flash Native Audio │
   │  • Flash 3.1          │
   │  • Pro 3.1            │
   │  • Pro 2.5            │
   └───────────────────────┘
```

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **3D:** Three.js via @react-three/fiber + @react-three/drei
- **Code editor:** Monaco Editor
- **Live backend:** FastAPI + Google ADK (bidirectional WebSocket streaming)
- **Quiz backend:** FastAPI + google-genai SDK
- **Persistence:** Firestore REST API
- **Deployment:** Google Cloud Run
- **GCP Project:** `relay-gemini`

## Google Cloud services used

- **Cloud Run** — live-bridge and quiz-engine as independent microservices
- **Vertex AI** — Gemini model access via service account (no API key)
- **Firestore** — user state, quiz history, community data
- **Google ADK** — agent framework for bidirectional audio/video streaming

## Local development

### Prerequisites

- Node.js 18+
- Python 3.13 (not 3.14 — pydantic-core wheels are missing)
- Google Cloud SDK (for deployment)

### 1. Frontend

```bash
npm install
```

Create `.env.local`:

```env
VITE_RELAY_API_BASE_URL=http://localhost:8082
VITE_RELAY_WS_URL=ws://localhost:8082
VITE_RELAY_QUIZ_API_BASE_URL=http://localhost:8083
VITE_RELAY_DEFAULT_USER_ID=faith

# Firestore persistence (optional)
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_PROJECT_ID=relay-gemini
```

```bash
npm run dev
```

Opens at `http://localhost:3000`. The app workspace is at `/relay-app`.

### 2. Live bridge backend

```bash
cd backend/live-bridge
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=app uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
```

Environment variables:

```env
GOOGLE_GENAI_USE_VERTEXAI=TRUE
GOOGLE_CLOUD_PROJECT=relay-gemini
GOOGLE_CLOUD_LOCATION=europe-west1
RELAY_LIVE_MODEL=gemini-live-2.5-flash-native-audio
RELAY_FLASH_MODEL=gemini-3.1-flash-preview
RELAY_PRO_MODEL=gemini-3.1-pro-preview
RELAY_REASONING_MODEL=gemini-2.5-pro
```

If not using Vertex AI locally, set `GOOGLE_API_KEY` instead.

### 3. Quiz engine backend

```bash
cd backend/quiz-engine
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8083 --reload
```

## Google Cloud deployment

```bash
gcloud run deploy relay-live-bridge \
  --source=backend/live-bridge \
  --region=europe-west1 \
  --allow-unauthenticated \
  --set-env-vars=GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=relay-gemini,GOOGLE_CLOUD_LOCATION=europe-west1,RELAY_LIVE_MODEL=gemini-live-2.5-flash-native-audio

gcloud run deploy relay-quiz-engine \
  --source=backend/quiz-engine \
  --region=europe-west1 \
  --allow-unauthenticated \
  --set-env-vars=GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=relay-gemini,GOOGLE_CLOUD_LOCATION=europe-west1
```

Full deployment commands are also in [`deployments.txt`](./deployments.txt).

## Build verification

```bash
npm run build                                          # Frontend (must pass)
python3 -m py_compile backend/live-bridge/app/main.py  # Backend syntax check
python3 -m py_compile backend/quiz-engine/app/main.py
```

## Gemini API session limits

The Gemini Live API imposes per-session limits:
- **15 minutes** for audio-only sessions
- **2 minutes** with video active

These are hard API limits. Ending a session and starting a new one gives fresh limits. The UI surfaces these limits so users understand disconnections are API-imposed, not bugs.

## Third-party libraries

- React, Vite, Tailwind CSS (MIT)
- Three.js, @react-three/fiber, @react-three/drei (MIT)
- Monaco Editor (MIT)
- Lucide React icons (ISC)
- FastAPI, Pydantic, Uvicorn (MIT/BSD)
- Google ADK, google-genai (Apache 2.0)

## Known limitations

- The sandbox validates circuit structure (component presence, wiring, connections) but does not compute voltages/currents like a SPICE simulator
- Firestore persistence requires a configured Firebase web API key
- Gemini Live API imposes hard session limits (15 min audio, 2 min video)
