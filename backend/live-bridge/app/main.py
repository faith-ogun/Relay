"""Relay Live Bridge — WebSocket server for bidi audio+video streaming with Gemini.

This service accepts WebSocket connections from the Relay frontend, receives
audio (PCM 16kHz) and video (JPEG frames) from the user's mic and webcam,
pipes them to the Gemini Live API via ADK, and streams audio responses back.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from google.adk.runners import Runner
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.sessions import InMemorySessionService
from google.genai import types

from relay_live_agent import agent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("relay.live-bridge")

# ── App setup ──────────────────────────────────────────────────────────────────

APP_NAME = os.getenv("RELAY_APP_NAME", "relay-live-bridge")

app = FastAPI(title="Relay Live Bridge", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

session_service = InMemorySessionService()
runner = Runner(
    app_name=APP_NAME,
    agent=agent,
    session_service=session_service,
)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "live-bridge",
        "runtime": "google-adk-bidi",
        "model": os.getenv("RELAY_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025"),
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_native_audio_model() -> bool:
    model = os.getenv("RELAY_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")
    return "native-audio" in model


def _build_run_config(stage: str = "inventory") -> RunConfig:
    """Build a RunConfig for bidi streaming based on the model type."""
    if _is_native_audio_model():
        return RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=["AUDIO"],
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            session_resumption=types.SessionResumptionConfig(),
        )
    # Fallback for non-native-audio models: text responses
    return RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["TEXT"],
        session_resumption=types.SessionResumptionConfig(),
    )


# ── WebSocket endpoint ─────────────────────────────────────────────────────────

@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    session_id: str,
) -> None:
    """Bidirectional streaming bridge between frontend and Gemini Live API.

    Client message formats:
    - Text:  {"type": "text", "text": "...", "stage": "wiring"}
    - Audio: raw binary bytes (PCM 16-bit, 16kHz mono)
    - Image: {"type": "image", "data": "<base64>", "mimeType": "image/jpeg"}
    - Stage: {"type": "stage", "stage": "code"}  (updates current stage context)
    - Close: {"type": "close"}

    Server sends:
    - ADK Event objects serialised as JSON (contains audio chunks, text, tool calls)
    """
    await websocket.accept()
    logger.info("WS connected: user=%s session=%s", user_id, session_id)

    # Get or create ADK session
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id,
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
        )
        logger.info("Created new ADK session: %s", session_id)

    current_stage = "inventory"
    run_config = _build_run_config(current_stage)
    live_queue = LiveRequestQueue()

    # Send initial stage context to the model
    stage_prompt = types.Content(
        role="user",
        parts=[types.Part(text=f"[stage={current_stage}] Session started. Awaiting user input.")],
    )
    live_queue.send_content(stage_prompt)

    # ── Upstream: client → Gemini ──────────────────────────────────────────────

    async def upstream() -> None:
        nonlocal current_stage
        try:
            while True:
                raw = await websocket.receive()

                # Binary frame → audio PCM
                if "bytes" in raw and raw["bytes"]:
                    audio_blob = types.Blob(
                        mime_type="audio/pcm;rate=16000",
                        data=raw["bytes"],
                    )
                    live_queue.send_realtime(audio_blob)
                    continue

                # Text frame → parse JSON message
                if "text" in raw and raw["text"]:
                    logger.info("Upstream text for %s: %s", session_id, raw["text"][:200])
                    try:
                        msg = json.loads(raw["text"])
                    except json.JSONDecodeError:
                        # Treat plain text as a text message
                        content = types.Content(
                            role="user",
                            parts=[types.Part(text=raw["text"])],
                        )
                        live_queue.send_content(content)
                        continue

                    msg_type = msg.get("type", "text")

                    if msg_type == "close":
                        break

                    if msg_type == "stage":
                        current_stage = msg.get("stage", current_stage)
                        stage_content = types.Content(
                            role="user",
                            parts=[types.Part(text=f"[stage changed to {current_stage}]")],
                        )
                        live_queue.send_content(stage_content)
                        continue

                    if msg_type == "text":
                        text = msg.get("text", "")
                        if text:
                            content = types.Content(
                                role="user",
                                parts=[types.Part(text=f"[stage={current_stage}] {text}")],
                            )
                            live_queue.send_content(content)
                        continue

                    if msg_type == "image":
                        image_data = msg.get("data", "")
                        mime_type = msg.get("mimeType", "image/jpeg")
                        if image_data:
                            decoded = base64.b64decode(image_data)
                            image_blob = types.Blob(
                                mime_type=mime_type,
                                data=decoded,
                            )
                            live_queue.send_realtime(image_blob)
                        continue

        except WebSocketDisconnect:
            logger.info("WS upstream disconnected: %s", session_id)
        except Exception:
            logger.exception("Upstream error for session %s", session_id)

    # ── Downstream: Gemini → client ────────────────────────────────────────────

    async def downstream() -> None:
        logger.info("Downstream starting for session %s", session_id)
        try:
            event_count = 0
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_queue,
                run_config=run_config,
            ):
                event_count += 1
                try:
                    payload = event.model_dump_json(exclude_none=True, by_alias=True)
                    logger.info("Event #%d for session %s: %s", event_count, session_id, payload[:200])
                    await websocket.send_text(payload)
                except Exception:
                    logger.exception("Error sending event to WS for session %s", session_id)
                    break
            logger.info("Downstream loop ended for session %s after %d events", session_id, event_count)
        except Exception:
            logger.exception("Downstream error for session %s", session_id)

    # ── Run both concurrently ──────────────────────────────────────────────────

    try:
        await asyncio.gather(upstream(), downstream(), return_exceptions=True)
    finally:
        live_queue.close()
        logger.info("WS session closed: %s", session_id)


# ── REST fallback for text-only usage ──────────────────────────────────────────

@app.post("/v1/live/text")
async def text_fallback(payload: dict) -> dict:
    """Simple REST endpoint for text-only interaction (non-streaming).

    Useful for testing without WebSocket or when audio is unavailable.
    """
    user_id = payload.get("user_id", "anonymous")
    session_id = payload.get("session_id", "")
    text = payload.get("text", "")
    stage = payload.get("stage", "inventory")

    if not text:
        return {"error": "text is required"}

    # Create session if needed
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id,
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
        )

    # Use standard (non-live) run for text
    from google.genai import types as genai_types
    message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=f"[stage={stage}] {text}")],
    )

    chunks: list[str] = []
    events = runner.run(
        user_id=user_id,
        session_id=session_id,
        new_message=message,
    )

    if hasattr(events, "__aiter__"):
        async for event in events:
            content = getattr(event, "content", None)
            if content and hasattr(content, "parts"):
                for part in content.parts:
                    if hasattr(part, "text") and part.text:
                        chunks.append(part.text)
    else:
        import inspect
        result = events
        if inspect.isawaitable(result):
            result = await result
        for event in result:
            content = getattr(event, "content", None)
            if content and hasattr(content, "parts"):
                for part in content.parts:
                    if hasattr(part, "text") and part.text:
                        chunks.append(part.text)

    return {
        "session_id": session_id,
        "stage": stage,
        "reply": "\n".join(chunks).strip() or "No response generated.",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
