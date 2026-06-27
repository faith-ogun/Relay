"""Ohmlet Reporter — the 3D digital-twin generation service (#31).

The final step of the core learning loop: when a build is finished, the learner
turns their real, completed circuit into a 3D digital twin they can keep, spin,
and share. This is the one post-session artifact Ohmlet produces.

It is a focused microservice (its own Cloud Run service, per the modular backend
design). It takes the final camera frame, calls a true image→mesh 3D-generation
provider (see providers.py), stores the resulting GLB in Cloud Storage, records
metadata in Firestore scoped to the owner, and streams the model back through an
authenticated endpoint. Generation is gated + metered per plan (#56) because each
twin is a real cost. Same resilience + observability spine as every Ohmlet
service (circuit breaker, structured logs, metrics, audit-ready).
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field

import entitlements
import obs
import ratelimit
import storage
import validation
from auth import uid_from_bearer
from cors import install_cors
from providers import TwinGenerationError, get_provider
from resilience import CircuitBreaker

logger = logging.getLogger("ohmlet.reporter")

app = FastAPI(title="Ohmlet Reporter", version="0.1.0")
install_cors(app)

# Per-call breaker: when the 3D provider is slow/down, fail fast with a clean 503
# instead of holding every request open for the full timeout (#50).
_GEN_CB = CircuitBreaker("twin-generate", fail_max=4, reset_timeout=60.0)
obs.metrics.register_breaker("twin-generate", _GEN_CB)


# ── Schemas ──
class TwinRequest(BaseModel):
    image_base64: str = Field(..., description="Final build photo (PNG/JPEG, base64; data: URL ok).")
    title: Optional[str] = Field(None, description="What the learner built.")
    sessionId: Optional[str] = None
    buildId: Optional[str] = None


class TwinView(BaseModel):
    id: str
    status: str
    title: str
    buildId: Optional[str] = None
    sessionId: Optional[str] = None
    provider: Optional[str] = None
    sizeBytes: Optional[int] = None
    createdAt: Optional[str] = None
    error: Optional[str] = None

    @staticmethod
    def of(rec: dict) -> "TwinView":
        return TwinView(
            id=rec.get("id", ""),
            status=rec.get("status", "unknown"),
            title=rec.get("title", "My build"),
            buildId=rec.get("buildId"),
            sessionId=rec.get("sessionId"),
            provider=rec.get("provider"),
            sizeBytes=rec.get("sizeBytes"),
            createdAt=rec.get("createdAt"),
            error=rec.get("error"),
        )


# ── Auth + rate-limit guard ──
def guard(request: Request, authorization: Optional[str] = Header(default=None)) -> str:
    uid = uid_from_bearer(authorization)
    obs.set_uid(uid)
    ratelimit.enforce_rest(request, uid)
    return uid


# ── Endpoints ──
@app.post("/v1/twin", response_model=TwinView)
def create_twin(req: TwinRequest, uid: str = Depends(guard)) -> TwinView:
    """Generate a 3D digital twin from the final build photo."""
    image = validation.decode_image(req.image_base64)
    title = validation.clean_title(req.title)
    build_id = validation.clean_id(req.buildId) or None
    session_id = validation.clean_id(req.sessionId) or None

    provider = get_provider()
    if provider is None:
        # Not configured in this environment — be honest, never fake an artifact.
        raise HTTPException(status_code=503, detail="3D twin generation isn't available right now.")

    # Server-side entitlement + monthly quota (#56). The twin is a paid artifact.
    plan = entitlements.get_plan(uid)
    quota = entitlements.monthly_quota(plan)
    used = storage.count_for_period(uid, entitlements.period())
    if used >= quota:
        raise HTTPException(
            status_code=402,
            detail=(
                "You've used all your 3D twins this month. Upgrade for more."
                if plan == "free"
                else "You've reached your monthly 3D twin limit."
            ),
        )

    twin_id = uuid.uuid4().hex
    storage.create_record(
        uid,
        twin_id,
        {"title": title, "buildId": build_id, "sessionId": session_id, "provider": provider.name, "plan": plan},
    )

    try:
        glb = _GEN_CB.call(provider.generate, image)
    except TwinGenerationError as exc:
        storage.update_record(twin_id, {"status": "failed", "error": str(exc)[:300]})
        obs.metrics.inc("twins_failed")
        logger.warning("twin generation failed for %s: %s", uid, exc)
        raise HTTPException(status_code=502, detail="The 3D twin couldn't be generated. Please try again.") from exc
    except Exception as exc:  # breaker open, etc.
        storage.update_record(twin_id, {"status": "failed", "error": "unavailable"})
        raise HTTPException(status_code=503, detail="3D twin generation is busy. Try again in a moment.") from exc

    size = storage.upload_glb(uid, twin_id, glb)
    storage.update_record(twin_id, {"status": "ready", "sizeBytes": size})
    obs.metrics.inc("twins_created")
    obs.audit("reporter.twin_created", uid=uid, twinId=twin_id, provider=provider.name, sizeBytes=size, plan=plan)

    rec = storage.get_record(uid, twin_id) or {}
    return TwinView.of(rec)


@app.get("/v1/twins")
def list_twins(uid: str = Depends(guard)) -> dict:
    """The caller's twins, newest first."""
    return {"twins": [TwinView.of(r).model_dump() for r in storage.list_records(uid)]}


@app.get("/v1/twins/{twin_id}", response_model=TwinView)
def get_twin(twin_id: str, uid: str = Depends(guard)) -> TwinView:
    rec = storage.get_record(uid, validation.clean_id(twin_id))
    if not rec:
        raise HTTPException(status_code=404, detail="Twin not found.")
    return TwinView.of(rec)


@app.get("/v1/twins/{twin_id}/model")
def get_twin_model(twin_id: str, uid: str = Depends(guard)) -> Response:
    """Stream the GLB mesh, after an ownership check. Private artifact (#44)."""
    tid = validation.clean_id(twin_id)
    rec = storage.get_record(uid, tid)
    if not rec:
        raise HTTPException(status_code=404, detail="Twin not found.")
    if rec.get("status") != "ready":
        raise HTTPException(status_code=409, detail="Twin is not ready yet.")
    glb = storage.download_glb(uid, tid)
    if glb is None:
        raise HTTPException(status_code=404, detail="Twin model is missing.")
    return Response(
        content=glb,
        media_type=storage.GLB_CONTENT_TYPE,
        headers={"Cache-Control": "private, max-age=86400", "Content-Disposition": f'inline; filename="{tid}.glb"'},
    )


@app.delete("/v1/twins/{twin_id}")
def delete_twin(twin_id: str, uid: str = Depends(guard)) -> dict:
    """Delete a twin and its mesh (user control + GDPR, #34)."""
    tid = validation.clean_id(twin_id)
    rec = storage.get_record(uid, tid)
    if not rec:
        raise HTTPException(status_code=404, detail="Twin not found.")
    storage.delete_glb(uid, tid)
    storage.delete_record(tid)
    obs.audit("reporter.twin_deleted", uid=uid, twinId=tid)
    return {"deleted": True, "id": tid}


@app.get("/health")
def health() -> dict[str, str]:
    provider = get_provider()
    return {"status": "ok", "service": "reporter", "provider": provider.name if provider else "unconfigured"}


# Observability last so its middleware wraps everything (#35).
obs.install_observability(app, "reporter")
