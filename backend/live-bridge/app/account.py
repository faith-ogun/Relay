"""Account + entitlements API (#56) — the client's view of who it is and what
its plan unlocks, derived server-side from the verified token.

`GET /v1/me` is the single source of truth the frontend reads instead of a
client-editable localStorage value. `PUT /v1/me/plan` lets an admin flip their
own plan to test the tiers; in production the Stripe webhook is the real writer
of the plan doc (#30), never the browser.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

import entitlements
import obs
from auth import is_admin, require_claims

logger = logging.getLogger("ohmlet.account")

router = APIRouter(prefix="/v1/me", tags=["account"])


def _cap_for_json(plan: str) -> float | None:
    """JSON has no infinity; an unlimited cap is represented as null."""
    cap = entitlements.live_cap_minutes(plan)
    return None if cap == float("inf") else cap


@router.get("")
def get_me(claims: dict = Depends(require_claims)) -> dict:
    """The signed-in user's identity + entitlements, all derived server-side."""
    uid = claims["uid"]
    plan = entitlements.get_plan(uid)
    return {
        "uid": uid,
        "email": claims.get("email"),
        "isAdmin": is_admin(claims),
        "plan": plan,
        "priorityModels": entitlements.has_priority_models(plan),
        "liveCapMinutes": _cap_for_json(plan),
        "liveSecondsUsedThisMonth": entitlements.live_seconds_used_this_period(uid),
    }


@router.put("/plan")
def set_my_plan(payload: dict, claims: dict = Depends(require_claims)) -> dict:
    """Admin-only plan override for testing the tiers (Stripe owns this in prod)."""
    if not is_admin(claims):
        raise HTTPException(status_code=403, detail="Only an admin can change a plan directly")
    requested = payload.get("plan") if isinstance(payload, dict) else None
    if requested not in entitlements.VALID_PLANS:
        raise HTTPException(status_code=422, detail=f"plan must be one of {entitlements.VALID_PLANS}")
    plan = entitlements.set_plan(claims["uid"], requested)
    obs.audit("account.plan_set_admin", uid=claims["uid"], plan=plan, by=claims.get("email"))
    logger.info("Admin %s set their plan to %s", claims.get("email"), plan)
    return {"plan": plan}
