"""Input validation + size limits for the vision-verifier (#45).

Every payload here carries a base64 image, so the dominant risk is oversized or
malformed image data (bandwidth + memory + Vertex cost). We bound the encoded
string and the decoded bytes, and decode strictly. All limits are env-tunable so
they can be tightened without a deploy.
"""

from __future__ import annotations

import base64
import os

from fastapi import HTTPException, status

# A camera frame is ~1-3 MB decoded; base64 inflates by ~4/3. Cap generously but
# finitely so a client cannot post an arbitrarily large body.
MAX_IMAGE_BYTES = int(os.getenv("OHMLET_MAX_IMAGE_BYTES", str(6 * 1024 * 1024)))      # 6 MB decoded
MAX_IMAGE_B64_CHARS = int(os.getenv("OHMLET_MAX_IMAGE_B64_CHARS", str(9 * 1024 * 1024)))  # ~6 MB encoded
MAX_PARTS = int(os.getenv("OHMLET_MAX_PARTS", "40"))
MAX_PART_CHARS = int(os.getenv("OHMLET_MAX_PART_CHARS", "80"))
MAX_HINT_CHARS = int(os.getenv("OHMLET_MAX_HINT_CHARS", "200"))


def decode_image(image_base64: str) -> bytes:
    """Validate + decode a base64 image, or raise a clean 4xx."""
    if not isinstance(image_base64, str) or not image_base64.strip():
        raise HTTPException(status_code=422, detail="image_base64 is required.")
    # Allow a data: URL prefix from the browser canvas (strip it).
    if image_base64.startswith("data:"):
        _, _, image_base64 = image_base64.partition(",")
    if len(image_base64) > MAX_IMAGE_B64_CHARS:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Image is too large.")
    try:
        raw = base64.b64decode(image_base64, validate=True)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="image_base64 is not valid base64.") from exc
    if not raw:
        raise HTTPException(status_code=422, detail="Image is empty.")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="Image is too large.")
    return raw


def clean_parts(parts: object) -> list[str]:
    """Bound the expected-parts list to sane sizes; drop junk entries."""
    if not isinstance(parts, list):
        return []
    out: list[str] = []
    for p in parts[:MAX_PARTS]:
        if isinstance(p, str) and p.strip():
            out.append(p.strip()[:MAX_PART_CHARS])
    return out


def clean_hint(hint: object) -> str:
    if not isinstance(hint, str):
        return ""
    return hint.strip()[:MAX_HINT_CHARS]
