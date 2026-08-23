"""First-party product analytics.

Deliberately not a third-party SDK. Ohmlet currently ships with no tracker of
any kind, which is why the privacy manifest can say `NSPrivacyTracking: false`
and the app shows no App Tracking Transparency prompt. Dropping in an analytics
SDK would flip that, cost a prompt most people decline, and hand a third party a
copy of who is learning what.

So events land here instead: our own endpoint, our own Firestore, in
europe-west1. It answers the questions that actually matter (where people stop,
what they do before they leave, whether a first build happens inside a week)
without any of that.

Rules:
  - The uid comes from the verified token, never the body. A client cannot
    attribute an event to someone else.
  - Events are capped and validated. This is an authenticated write path, so it
    is also a way to fill a database if left open.
  - Deleting an account deletes its events, like everything else.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from google.cloud import firestore

import obs
import ratelimit
from auth import require_claims

logger = logging.getLogger("ohmlet.events")

router = APIRouter(prefix="/v1/events", tags=["events"])

EVENTS_COLLECTION = os.getenv("OHMLET_EVENTS_COLLECTION", "ohmlet_events")

# The catalogue is closed on purpose. An open `name` field becomes a hundred
# near-duplicate spellings within a month and the funnel stops being answerable.
# Mirrors frontend/services/analytics.ts; add to both or neither.
KNOWN_EVENTS = {
    # Acquisition and activation
    "sign_up", "login", "onboarding_complete", "setup_complete",
    "lesson_start", "lesson_complete",
    "live_session_start", "live_session_end",
    # North star: a real bench build, and the first one per learner (FBC7)
    "build_complete", "first_build_complete",
    # Engagement and retention
    "streak_extended", "challenge_join", "challenge_leave",
    "simulator_open", "sketch_compile", "twin_generated",
    "twin_shared", "shared_twin_view", "shared_twin_cta",
    "interview_start", "interview_complete",
    # Commercial
    "paywall_view", "checkout_start", "purchase_complete", "restore_purchases",
    # The one that answers "why did they go". Fired from the deletion flow
    # before the account disappears, since afterwards there is nobody to ask.
    "account_delete_start", "account_deleted",
}

MAX_BATCH = 50
MAX_PROPS = 12
MAX_STR = 200


def _clean_props(raw: Any) -> dict:
    """Keep a small, flat, typed set of properties. Nested objects and long
    strings are where an event store turns into an accidental data lake."""
    if not isinstance(raw, dict):
        return {}
    out: dict[str, Any] = {}
    for k, v in list(raw.items())[:MAX_PROPS]:
        key = str(k)[:40]
        if isinstance(v, bool) or isinstance(v, int) or isinstance(v, float):
            out[key] = v
        elif isinstance(v, str):
            out[key] = v[:MAX_STR]
        # Anything else is dropped rather than coerced, so a shape change in the
        # client shows up as a missing property instead of silent junk.
    return out


@router.post("")
async def ingest(request: Request, claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    obs.set_uid(uid)
    ratelimit.enforce_rest(request, uid)

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid payload")

    batch_in = body.get("events") if isinstance(body, dict) else None
    if not isinstance(batch_in, list) or not batch_in:
        raise HTTPException(422, "events must be a non-empty list")
    if len(batch_in) > MAX_BATCH:
        raise HTTPException(413, f"At most {MAX_BATCH} events per request.")

    from state_store import get_client

    client = get_client()
    writer = client.batch()
    accepted = 0
    unknown: list[str] = []

    for item in batch_in:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "")
        if name not in KNOWN_EVENTS:
            unknown.append(name[:40])
            continue
        doc = client.collection(EVENTS_COLLECTION).document()
        writer.set(doc, {
            "uid": uid,
            "name": name,
            "props": _clean_props(item.get("props")),
            # The client clock is recorded but the server's is authoritative: a
            # device with the wrong date would otherwise reorder a funnel.
            "clientAt": str(item.get("at") or "")[:40],
            "at": firestore.SERVER_TIMESTAMP,
            "platform": str(item.get("platform") or "")[:20],
        })
        accepted += 1

    if accepted:
        writer.commit()

    if unknown:
        # Loud, because a typo in an event name is invisible in a dashboard: the
        # funnel simply shows fewer people than really passed through.
        logger.warning("rejected unknown events from %s: %s", uid, sorted(set(unknown))[:5])

    return {"accepted": accepted, "rejected": len(batch_in) - accepted}
