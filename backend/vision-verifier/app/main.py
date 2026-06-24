"""Ohmlet Vision-Verifier — the camera component inventory check (#33).

Step 2 of the core learning loop: before a learner starts wiring, they point the
camera at their parts and the tutor confirms the kit. This service takes a single
frame plus the build's expected parts list and returns, per part, whether it can
see it (present / missing / unsure), what extras it noticed, and an encouraging
verdict on whether the bench is ready.

It is a focused, latency-tuned vision microservice (its own Cloud Run service,
per the modular backend design): Gemini 3.5 Flash with thinking disabled and a
strict JSON response schema, so a kit check is a ~2-3s round trip, not a slow,
rambling free-text answer. Same resilience + observability spine as every other
Ohmlet service (circuit breakers, structured logs, metrics, audit-ready).
"""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

import obs
import ratelimit
import validation
from auth import uid_from_bearer
from cors import install_cors
from resilience import CircuitBreaker

logger = logging.getLogger("ohmlet.vision-verifier")

# ── Model + client (latency + lifecycle) ──
# Pinned to GA Gemini 3.5 Flash, served from the `global` Vertex location (the
# 2.5 family retires on Vertex 2026-10-16; 3.1 Flash is preview-only). Mirrors
# the quiz-engine's vision path exactly so behaviour is consistent across the
# fleet. Env-overridable.
VISION_MODEL = os.getenv("OHMLET_VISION_MODEL", "gemini-3.5-flash")
GENAI_TIMEOUT_MS = int(os.getenv("OHMLET_GENAI_TIMEOUT_MS", "15000"))

app = FastAPI(title="Ohmlet Vision Verifier", version="0.1.0")
install_cors(app)

# Per-call breaker: when Vertex is slow/down, fail fast with a clean 503 instead
# of making every learner wait out the full timeout (#50).
_VERIFY_CB = CircuitBreaker("inventory-verify", fail_max=4, reset_timeout=30.0)
_IDENTIFY_CB = CircuitBreaker("component-identify", fail_max=4, reset_timeout=30.0)
obs.metrics.register_breaker("inventory-verify", _VERIFY_CB)
obs.metrics.register_breaker("component-identify", _IDENTIFY_CB)


@lru_cache(maxsize=1)
def _genai_client():
    """Gemini client (Vertex AI or API key), built once and reused.

    Cached so we don't pay client construction + Vertex auth discovery per
    request. A hard request timeout means a single call can never hang forever."""
    try:
        from google import genai
        from google.genai import types as genai_types

        http_opts = genai_types.HttpOptions(timeout=GENAI_TIMEOUT_MS)
        if os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").lower() == "true":
            return genai.Client(
                vertexai=True,
                project=os.getenv("GOOGLE_CLOUD_PROJECT", "ohmlet-app"),
                location=os.getenv("GOOGLE_CLOUD_LOCATION", "global"),
                http_options=http_opts,
            )
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            return genai.Client(api_key=api_key, http_options=http_opts)
    except ImportError:
        pass
    return None


# ── Request/response models ──

class VerifyInventoryRequest(BaseModel):
    image_base64: str
    expected_parts: list[str] = Field(default_factory=list)
    build_title: Optional[str] = None


class PartStatus(BaseModel):
    name: str
    status: str  # present | missing | unsure  (normalized server-side)
    note: Optional[str] = None


class VerifyInventoryResponse(BaseModel):
    parts: list[PartStatus]
    found_extras: list[str] = Field(default_factory=list)
    ready: bool
    feedback: str
    confidence: float


class IdentifyComponentRequest(BaseModel):
    image_base64: str
    hint: Optional[str] = None


class IdentifyComponentResponse(BaseModel):
    name: str
    value: Optional[str] = None
    purpose: str
    tip: str
    confidence: float


# ── Auth + rate-limit guard ──

def guard(request: Request, authorization: Optional[str] = Header(default=None)) -> str:
    """Verify the Firebase token (derive UID server-side), bind it for logging,
    and apply the per-identity REST rate limit. Every endpoint depends on this."""
    uid = uid_from_bearer(authorization)
    obs.set_uid(uid)
    ratelimit.enforce_rest(request, uid)
    return uid


# ── Endpoints ──

_VALID_STATUS = {"present", "missing", "unsure"}


@app.post("/v1/verify-inventory", response_model=VerifyInventoryResponse)
def verify_inventory(req: VerifyInventoryRequest, uid: str = Depends(guard)) -> VerifyInventoryResponse:
    """Check a photo of the learner's bench against a build's expected parts."""
    image_bytes = validation.decode_image(req.image_base64)
    expected = validation.clean_parts(req.expected_parts)
    if not expected:
        raise HTTPException(422, "expected_parts must list at least one component.")

    client = _genai_client()
    if not client or not _VERIFY_CB.allow():
        # Degrade cleanly: the learner can retry, or proceed and let the live
        # tutor eyeball the parts. Never a slow opaque 500.
        raise HTTPException(
            503,
            "Kit check is busy right now. Try again in a moment, or just start and I'll watch as you go.",
            headers={"Retry-After": "15"},
        )

    build = (req.build_title or "this build").strip()[:120]
    prompt = f"""You are Ohmlet's bench assistant doing a parts inventory check for "{build}".
The learner has laid their components out and taken one photo.

Expected parts for the build:
{json.dumps(expected, indent=2)}

Look at the photo and, for EACH expected part, decide:
- "present": you can clearly see this part (or a valid equivalent) in the photo.
- "missing": you are fairly sure it is not in the photo.
- "unsure": you cannot tell (blurry, hidden, ambiguous, out of frame).

Rules:
- Be encouraging but honest; do not mark something present just to be nice.
- A resistor's exact value can't be read by eye, so judge resistors by presence, not value, and say so in the note if relevant.
- "found_extras": notable electronics parts you see that are NOT in the expected list (short names).
- "ready": true only if every expected part is "present".
- "feedback": one or two short, warm sentences telling the learner what to grab next, or that they're good to go. No emojis.
- "confidence": 0.0-1.0, your overall confidence in this assessment.
- Each part's "note" is optional and at most one short clause.

Use exactly the expected part names in the "name" field."""

    try:
        from google.genai import types

        config = types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=1024,
            response_mime_type="application/json",
            response_schema=VerifyInventoryResponse,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        )
        response = client.models.generate_content(
            model=VISION_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(text=prompt),
                        types.Part(inline_data=types.Blob(data=image_bytes, mime_type="image/jpeg")),
                    ],
                ),
            ],
            config=config,
        )
        data = json.loads(response.text)
        result = _normalize_inventory(data, expected)
        _VERIFY_CB.record_success()
        obs.metrics.inc("inventory_checks")
        if not result.ready:
            obs.metrics.inc("inventory_incomplete")
        return result
    except HTTPException:
        raise
    except Exception as exc:
        _VERIFY_CB.record_failure()
        logger.warning("verify-inventory failed: %s", exc)
        raise HTTPException(
            503,
            "Couldn't check your kit just now. Please try again.",
            headers={"Retry-After": "10"},
        ) from exc


@app.post("/v1/identify-component", response_model=IdentifyComponentResponse)
def identify_component(req: IdentifyComponentRequest, uid: str = Depends(guard)) -> IdentifyComponentResponse:
    """Identify a single component the learner is holding up to the camera."""
    image_bytes = validation.decode_image(req.image_base64)
    hint = validation.clean_hint(req.hint)

    client = _genai_client()
    if not client or not _IDENTIFY_CB.allow():
        raise HTTPException(
            503,
            "Component ID is busy right now. Please try again in a moment.",
            headers={"Retry-After": "15"},
        )

    prompt = f"""You are Ohmlet's bench assistant. The learner is holding one electronic
component up to the camera and wants to know what it is.{f' They said: "{hint}".' if hint else ''}

Identify the single most prominent component in the photo and return:
- "name": the component name (e.g. "LDR (photoresistor)", "220 ohm resistor", "Arduino Uno").
- "value": its value/rating if visibly determinable, else null.
- "purpose": one short sentence on what it does.
- "tip": one short, beginner-friendly tip for using it. No emojis.
- "confidence": 0.0-1.0.

If you genuinely cannot tell, say so honestly in "name" with low confidence."""

    try:
        from google.genai import types

        config = types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=512,
            response_mime_type="application/json",
            response_schema=IdentifyComponentResponse,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        )
        response = client.models.generate_content(
            model=VISION_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(text=prompt),
                        types.Part(inline_data=types.Blob(data=image_bytes, mime_type="image/jpeg")),
                    ],
                ),
            ],
            config=config,
        )
        data = json.loads(response.text)
        _IDENTIFY_CB.record_success()
        obs.metrics.inc("component_ids")
        return IdentifyComponentResponse(
            name=str(data.get("name", "Unknown component"))[:120],
            value=(str(data["value"])[:80] if data.get("value") else None),
            purpose=str(data.get("purpose", ""))[:300],
            tip=str(data.get("tip", ""))[:300],
            confidence=_clamp01(data.get("confidence", 0.5)),
        )
    except HTTPException:
        raise
    except Exception as exc:
        _IDENTIFY_CB.record_failure()
        logger.warning("identify-component failed: %s", exc)
        raise HTTPException(
            503,
            "Couldn't identify that part just now. Please try again.",
            headers={"Retry-After": "10"},
        ) from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vision-verifier", "model": VISION_MODEL}


# ── Helpers ──

def _clamp01(v: object) -> float:
    try:
        return max(0.0, min(1.0, float(v)))
    except (TypeError, ValueError):
        return 0.5


def _normalize_inventory(data: dict, expected: list[str]) -> VerifyInventoryResponse:
    """Defensively normalize the model's JSON: keep the verdict anchored to the
    expected parts list, clamp values, and recompute `ready` from the parts so it
    can never disagree with the per-part statuses."""
    by_name = {}
    for p in data.get("parts", []) or []:
        if isinstance(p, dict) and p.get("name"):
            by_name[str(p["name"]).strip().lower()] = p

    parts: list[PartStatus] = []
    for name in expected:
        p = by_name.get(name.strip().lower(), {})
        status = str(p.get("status", "unsure")).strip().lower()
        if status not in _VALID_STATUS:
            status = "unsure"
        note = p.get("note")
        parts.append(PartStatus(name=name, status=status, note=(str(note)[:160] if note else None)))

    extras = [str(e)[:80] for e in (data.get("found_extras") or []) if isinstance(e, str) and e.strip()][:12]
    ready = all(p.status == "present" for p in parts)
    feedback = str(data.get("feedback", "")).strip()[:400] or (
        "You're all set — let's start wiring." if ready else "Grab the missing parts and run the check again."
    )
    return VerifyInventoryResponse(
        parts=parts,
        found_extras=extras,
        ready=ready,
        feedback=feedback,
        confidence=_clamp01(data.get("confidence", 0.6)),
    )


# Observability last so its middleware wraps everything (#35).
obs.install_observability(app, "vision-verifier")
