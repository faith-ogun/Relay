"""Ohmlet Live Bridge — WebSocket server for bidi audio+video streaming with Gemini.

This service accepts WebSocket connections from the Ohmlet frontend, receives
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

from ohmlet_live_agent import agent
from ohmlet_live_agent.tools import set_priority_models
from state_store import router as state_router
from usage_meter import UsageMeter, persist_usage
import entitlements

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ohmlet.live-bridge")

# ── App setup ──────────────────────────────────────────────────────────────────

APP_NAME = os.getenv("OHMLET_APP_NAME", "ohmlet-live-bridge")

app = FastAPI(title="Ohmlet Live Bridge", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# User-state persistence (Firestore via service account). Self-contained router.
app.include_router(state_router)

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
        "model": os.getenv("OHMLET_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025"),
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_native_audio_model() -> bool:
    model = os.getenv("OHMLET_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")
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
            realtime_input_config=types.RealtimeInputConfig(
                automaticActivityDetection=types.AutomaticActivityDetection(
                    startOfSpeechSensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                ),
                activityHandling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
            ),
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

    # ── Entitlement gate: plan + daily live budget (the real, server-side cap) ──
    plan = entitlements.get_plan(user_id)
    remaining_seconds = entitlements.live_seconds_remaining(user_id, plan)
    if remaining_seconds <= 0:
        logger.info("Live budget exhausted for user=%s plan=%s; rejecting", user_id, plan)
        await websocket.send_text(
            json.dumps(
                {
                    "type": "error",
                    "code": "live_budget_exhausted",
                    "plan": plan,
                    "message": "You have used today's live tutoring time on this plan.",
                }
            )
        )
        await websocket.close(code=4003)
        return

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
    meter = UsageMeter(user_id=user_id, session_id=session_id)

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
                    meter.on_audio_in(len(raw["bytes"]))
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
                            meter.on_text()
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
                            meter.on_image()
                        continue

        except WebSocketDisconnect:
            logger.info("WS upstream disconnected: %s", session_id)
        except Exception:
            logger.exception("Upstream error for session %s", session_id)

    # ── Downstream: Gemini → client ────────────────────────────────────────────

    async def downstream() -> None:
        logger.info("Downstream starting for session %s", session_id)
        # Select the model tier for this session's plan (Free → Flash, Pro/max → Pro).
        set_priority_models(entitlements.has_priority_models(plan))
        try:
            event_count = 0
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_queue,
                run_config=run_config,
            ):
                event_count += 1
                meter.on_event(event)
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

    # ── Idle guardrail: stop billing for an abandoned session ───────────────────

    async def watchdog() -> None:
        timeout = float(os.getenv("OHMLET_IDLE_TIMEOUT_SEC", "180"))
        while True:
            await asyncio.sleep(10)
            # Idle: stop billing for an abandoned session.
            if meter.idle_seconds() > timeout:
                logger.info(
                    "Idle timeout (%.0fs) for session %s; closing", timeout, session_id
                )
                try:
                    await websocket.close()
                except Exception:
                    pass
                return
            # Budget: cut the session off when it runs past the plan's daily cap.
            if remaining_seconds != float("inf") and meter.duration_seconds() >= remaining_seconds:
                logger.info(
                    "Live budget reached (%.0fs) for user=%s session=%s; closing",
                    remaining_seconds, user_id, session_id,
                )
                try:
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "error",
                                "code": "live_budget_exhausted",
                                "plan": plan,
                                "message": "You've reached today's live tutoring time on this plan.",
                            }
                        )
                    )
                    await websocket.close(code=4003)
                except Exception:
                    pass
                return

    # ── Run concurrently; first to finish (close / disconnect / idle) ends it ───

    tasks = [
        asyncio.create_task(upstream()),
        asyncio.create_task(downstream()),
        asyncio.create_task(watchdog()),
    ]
    try:
        _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
    finally:
        live_queue.close()
        persist_usage(meter)
        # Charge this session's wall-clock time against today's live budget so the
        # cap holds across reconnects and multiple sessions in a day.
        entitlements.add_live_seconds(user_id, meter.duration_seconds())
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

    # The live agent uses a native-audio model that only works with run_live().
    # For text-only chat, call Gemini directly via google-genai SDK.
    from google import genai
    from ohmlet_live_agent.agent import OHMLET_INSTRUCTION

    use_vertex = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() == "true"
    if use_vertex:
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT", "ohmlet-app"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "europe-west1"),
        )
    else:
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY", ""))

    text_model = os.getenv("OHMLET_FLASH_MODEL", "gemini-2.5-flash")

    try:
        response = client.models.generate_content(
            model=text_model,
            contents=f"[stage={stage}] {text}",
            config=genai.types.GenerateContentConfig(
                system_instruction=OHMLET_INSTRUCTION,
            ),
        )
        reply = response.text.strip() if response.text else "No response generated."
    except Exception as e:
        logger.error("Text fallback failed: %s", e)
        reply = f"Sorry, I hit an error: {e}"

    return {
        "session_id": session_id,
        "stage": stage,
        "reply": reply,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
