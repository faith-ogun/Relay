"""Account + entitlements API (#56) — the client's view of who it is and what
its plan unlocks, derived server-side from the verified token.

`GET /v1/me` is the single source of truth the frontend reads instead of a
client-editable localStorage value. `PUT /v1/me/plan` lets an admin flip their
own plan to test the tiers; in production the Stripe webhook is the real writer
of the plan doc (#30), never the browser.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

import bosses as bosses_mod
import checkpoints as checkpoints_mod
import entitlements
import hearts as hearts_mod
import idempotency
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
        "hearts": hearts_mod.status(uid, plan),
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


@router.get("/hearts")
def get_hearts(claims: dict = Depends(require_claims)) -> dict:
    """The learner's live heart balance and regen clock.

    Separate from GET /v1/me because hearts move on their own: the lesson screen
    re-reads this while a learner waits for the next one, and that should not
    drag the whole entitlement payload along behind it.
    """
    uid = claims["uid"]
    return hearts_mod.status(uid, entitlements.get_plan(uid))


@router.post("/hearts/spend")
def spend_heart(
    claims: dict = Depends(require_claims),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> dict:
    """Charge one heart for a wrong answer, and report what is left.

    The client sends a key unique to (run, step). A flaky connection retrying
    the same miss must not cost two hearts, and a claimed key returns the
    current balance unchanged rather than an error, so the retry looks to the
    learner exactly like the call that got lost.
    """
    uid = claims["uid"]
    plan = entitlements.get_plan(uid)
    if hearts_mod.is_unlimited(plan):
        return hearts_mod.status(uid, plan)

    if idempotency_key:
        try:
            if not idempotency.claim_event(f"heart:{uid}:{idempotency_key}"):
                return hearts_mod.status(uid, plan)
        except Exception as exc:
            # The claim store being down must not make a wrong answer free, and
            # must not fail the lesson either. Charge it: a duplicate charge on
            # a rare retry is fairer to the business than a free pass on every
            # miss for as long as the outage lasts.
            logger.warning("heart idempotency claim failed for %s: %s", uid, exc)

    return hearts_mod.spend(uid, plan)


@router.get("/checkpoints")
def get_checkpoints(claims: dict = Depends(require_claims)) -> dict:
    """What the learner has claimed, and what is earned but unpaid."""
    return checkpoints_mod.status(claims["uid"])


@router.post("/checkpoints/claim")
def claim_checkpoints(claims: dict = Depends(require_claims)) -> dict:
    """Grant every checkpoint earned and not yet paid for.

    No idempotency header needed: the transaction inside is the guard, and a
    repeated call simply finds nothing left to grant. That is a stronger promise
    than a key, which only protects against a retry of the SAME request.
    """
    uid = claims["uid"]
    result = checkpoints_mod.claim_all(uid)
    if result["granted"]:
        obs.audit("checkpoint.granted", uid=uid, xp=result["xp"], count=len(result["granted"]))
    return result


class BossResult(BaseModel):
    """What a client may say about an exam it has just sat.

    Deliberately thin. The seed identifies WHICH exam, so the server re-composes
    it and owns every derived number; `firstTryCorrect` is a list of question
    indices, so a client cannot report a question it was never asked or claim a
    longer exam than the one it was given. Anything out of range is discarded
    rather than rejected: an off-by-one from a client bug should cost that
    question, not the whole sitting.
    """

    seed: str = Field(min_length=8, max_length=64)
    firstTryCorrect: list[int] = Field(default_factory=list, max_length=64)


@router.get("/bosses")
def get_bosses(claims: dict = Depends(require_claims)) -> dict:
    """Every unit's boss: reachable, ready, cleared, best score."""
    return bosses_mod.status(claims["uid"])


@router.get("/bosses/{unit_id}/exam")
def get_boss_exam(unit_id: str, claims: dict = Depends(require_claims)) -> dict:
    """Compose a fresh exam for this unit.

    Refused unless the learner has actually finished the unit and cleared the one
    before it. The phone hides a locked boss anyway; this is the check that makes
    the gate real rather than cosmetic.
    """
    uid = claims["uid"]
    state = {u["unitId"]: u for u in bosses_mod.status(uid)["units"]}
    row = state.get(unit_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No such unit.")
    if not row["ready"]:
        raise HTTPException(status_code=409, detail="Finish this unit's lessons first.")
    if not row["reachable"]:
        raise HTTPException(status_code=409, detail="Clear the previous unit first.")
    try:
        return bosses_mod.exam(uid, unit_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="No such unit.")


@router.post("/bosses/{unit_id}/result")
def post_boss_result(unit_id: str, body: BossResult, claims: dict = Depends(require_claims)) -> dict:
    """Grade a sat exam and pay for a first clear.

    No idempotency header: the transaction is the guard. A resubmitted result
    records another attempt and grants nothing further, because the grant is
    conditioned on the stored `cleared` flag rather than on this request being
    the first one to arrive.
    """
    uid = claims["uid"]
    try:
        result = bosses_mod.submit(uid, unit_id, body.seed, body.firstTryCorrect)
    except KeyError:
        raise HTTPException(status_code=404, detail="No such unit.")
    except ValueError:
        raise HTTPException(status_code=422, detail="That exam could not be graded.")
    if result["firstClear"]:
        obs.audit("boss.cleared", uid=uid, unitId=unit_id, xp=result["xp"], ratio=round(result["ratio"], 3))
    return result
