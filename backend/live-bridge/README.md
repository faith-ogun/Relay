# Relay Live Bridge

Real-time bidirectional streaming service connecting the Relay frontend to Gemini's Live API via Google ADK.

## What it does

- Accepts WebSocket connections from the Relay frontend
- Receives audio (PCM 16kHz) from the user's microphone
- Receives video frames (JPEG) from the user's webcam
- Streams everything to Gemini via ADK bidi-streaming
- Streams Gemini's audio responses back to the frontend in real-time

## Architecture

```
Browser (mic + cam)  ←→  WebSocket  ←→  Live Bridge  ←→  ADK Runner  ←→  Gemini Live API
```

## Local development

```bash
cd backend/live-bridge

# Create venv and install deps
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set your API key
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY

# Run
PYTHONPATH=app uvicorn app.main:app --host 0.0.0.0 --port 8082 --reload
```

## WebSocket protocol

Connect to `ws://localhost:8082/ws/{user_id}/{session_id}`

### Client → Server

| Format | Description |
|--------|-------------|
| Binary frame | Raw PCM audio (16-bit, 16kHz mono) |
| `{"type": "text", "text": "...", "stage": "wiring"}` | Text message with stage context |
| `{"type": "image", "data": "<base64>", "mimeType": "image/jpeg"}` | Webcam frame |
| `{"type": "stage", "stage": "code"}` | Update current build stage |
| `{"type": "close"}` | Graceful disconnect |

### Server → Client

ADK Event objects serialised as JSON. These contain audio chunks (base64), text transcriptions, and tool call results.

## Cloud Run deployment

```bash
gcloud run deploy relay-live-bridge \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=relay-gemini,GOOGLE_CLOUD_LOCATION=europe-west1"
```

## Constraints

- Audio: 16-bit PCM, 16kHz mono input; 24kHz output
- Video: max 1 fps, 768x768 recommended
- Session limit: 15 min audio-only, 2 min with video (Gemini API)
