"""Input validation + size limits (#45).

The server treats every client payload as hostile: bounded sizes, checked
shapes, rejected junk. This blunts both accidents (a runaway client) and abuse
(oversized writes to exhaust Firestore's 1 MB/doc limit, or huge frames to burn
bandwidth). Firestore via the Admin SDK is not SQL, so the threat here is
oversized/malformed data rather than query injection; anything rendered in the
browser is escaped by React, so the focus is size + shape.

All limits are env-tunable so they can be tightened without a deploy.
"""

from __future__ import annotations

import json
import os
from typing import Any

from fastapi import HTTPException

# ── Size ceilings ──
MAX_BODY_BYTES = int(os.getenv("OHMLET_MAX_BODY_BYTES", str(256 * 1024)))        # 256 KB REST body
MAX_STATE_BYTES = int(os.getenv("OHMLET_MAX_STATE_BYTES", str(200 * 1024)))      # 200 KB state envelope (< Firestore 1 MB)
MAX_WS_TEXT_CHARS = int(os.getenv("OHMLET_MAX_WS_TEXT_CHARS", "4000"))           # a chat turn
MAX_WS_IMAGE_BYTES = int(os.getenv("OHMLET_MAX_WS_IMAGE_BYTES", str(3 * 1024 * 1024)))  # 3 MB decoded frame

VALID_STAGES = {"inventory", "wiring", "code", "test"}


def _too_large(label: str, size: int, limit: int) -> HTTPException:
    # Numeric 413 (not status.HTTP_413_*): the constant's name differs across
    # Starlette versions (CONTENT_TOO_LARGE vs REQUEST_ENTITY_TOO_LARGE), and
    # google-adk's dep tree can resolve an older Starlette. 413 is version-proof.
    return HTTPException(
        status_code=413,
        detail=f"{label} is too large ({size} > {limit} bytes).",
    )


def validate_state_envelope(payload: Any) -> dict[str, Any]:
    """Validate the user-state envelope the frontend persists.

    Shape: {version: int, data: object, updatedAt: str}. We do not interpret
    `data` (it is opaque app state) but we DO bound the whole thing so a client
    cannot write an unbounded document.
    """
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="State payload must be a JSON object.")

    try:
        encoded = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="State payload is not serialisable.") from exc
    if len(encoded) > MAX_STATE_BYTES:
        raise _too_large("State", len(encoded), MAX_STATE_BYTES)

    # Envelope shape is advisory (the client owns it) but if present it must be sane.
    if "version" in payload and not isinstance(payload["version"], int):
        raise HTTPException(status_code=422, detail="State 'version' must be an integer.")
    if "data" in payload and not isinstance(payload["data"], (dict, list)):
        raise HTTPException(status_code=422, detail="State 'data' must be an object or array.")
    if "updatedAt" in payload and not isinstance(payload["updatedAt"], str):
        raise HTTPException(status_code=422, detail="State 'updatedAt' must be a string.")
    return payload


def validate_ws_text(text: Any) -> str:
    """A chat turn: a non-empty string within the length cap."""
    if not isinstance(text, str):
        return ""
    if len(text) > MAX_WS_TEXT_CHARS:
        return text[:MAX_WS_TEXT_CHARS]
    return text


def ws_image_ok(decoded_len: int) -> bool:
    """True if a decoded image frame is within the size cap."""
    return 0 < decoded_len <= MAX_WS_IMAGE_BYTES


def normalize_stage(stage: Any, current: str) -> str:
    """Only accept known stages; ignore anything else."""
    return stage if isinstance(stage, str) and stage in VALID_STAGES else current
