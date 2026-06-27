"""Input validation + size limits for the reporter (#45).

The twin request carries a base64 camera frame plus a few short labels. The
dominant risk is oversized/malformed image data (bandwidth, memory, provider
cost), so we bound the encoded string and decoded bytes and decode strictly.
All limits are env-tunable.
"""

from __future__ import annotations

import base64
import os
import re

from fastapi import HTTPException

MAX_IMAGE_BYTES = int(os.getenv("OHMLET_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))           # 8 MB decoded
MAX_IMAGE_B64_CHARS = int(os.getenv("OHMLET_MAX_IMAGE_B64_CHARS", str(11 * 1024 * 1024)))  # ~8 MB encoded
MAX_TITLE_CHARS = int(os.getenv("OHMLET_MAX_TWIN_TITLE", "120"))
MAX_ID_CHARS = 80
_ID_RE = re.compile(r"[^A-Za-z0-9._-]")


def decode_image(image_base64: str) -> bytes:
    """Validate + decode a base64 image, or raise a clean 4xx."""
    if not isinstance(image_base64, str) or not image_base64.strip():
        raise HTTPException(status_code=422, detail="image_base64 is required.")
    if image_base64.startswith("data:"):
        _, _, image_base64 = image_base64.partition(",")
    if len(image_base64) > MAX_IMAGE_B64_CHARS:
        raise HTTPException(status_code=413, detail="Image is too large.")
    try:
        raw = base64.b64decode(image_base64, validate=True)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="image_base64 is not valid base64.") from exc
    if not raw:
        raise HTTPException(status_code=422, detail="Image is empty.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large.")
    return raw


def clean_title(value: object, fallback: str = "My build") -> str:
    if not isinstance(value, str) or not value.strip():
        return fallback
    return value.strip()[:MAX_TITLE_CHARS]


def clean_id(value: object) -> str:
    """Sanitise a client-supplied id (sessionId/buildId) to a safe token, or ''."""
    if not isinstance(value, str):
        return ""
    return _ID_RE.sub("", value.strip())[:MAX_ID_CHARS]
