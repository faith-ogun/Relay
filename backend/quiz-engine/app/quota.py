"""Monthly abuse ceilings for the REST services that call Gemini.

Not a paywall. These sit far above what any real learner does, and a learner who
notices one has almost certainly found a bug rather than a limit.

The gap they close is specific. `ratelimit.py` caps VELOCITY at 120 requests a
minute per identity, which sounds protective until you multiply it out: that is
172,800 calls a day from one signed-in account, every one of them a Gemini call
we pay for. Rate limiting bounds how fast someone can spend our money, not how
much. Nothing bounded the total.

Three properties, and they are the same three the hearts and live-minute budgets
already have, because those are the parts of this codebase that got it right:

  1. **Server-side, keyed on the verified uid.** The client is never asked and
     never trusted. A device-held counter is not a ceiling.
  2. **Atomic.** Read and increment inside one Firestore transaction, so two
     devices hammering in parallel cannot both see "one left".
  3. **Fails OPEN.** If Firestore is unreachable the request proceeds. This is a
     deliberate inversion of how entitlements fail: an entitlement failing open
     gives away something paid for, while an abuse ceiling failing CLOSED would
     block every honest learner during an outage to stop an attacker we may not
     even have. The cost of being wrong is asymmetric, so the direction is too.

Counters live in one document per (uid, month) so the cost is one transaction
per call, and they expire naturally by being keyed on the month: nothing to
clean up, and last month's document is simply never read again.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

logger = logging.getLogger("ohmlet.quota")

QUOTA_COLLECTION = os.getenv("OHMLET_QUOTA_COLLECTION", "ohmlet_quota")

# Generous on purpose. Sized from what a heavy learner plausibly does in a month,
# multiplied by a comfortable margin, so the ceiling only ever meets a script.
DEFAULT_LIMITS: dict[str, int] = {
    # A kit check per build, plus retries when a component is hard to see.
    "vision": int(os.getenv("OHMLET_QUOTA_VISION", "500")),
    # Question generation and drawing assessment, several per lesson.
    "quiz": int(os.getenv("OHMLET_QUOTA_QUIZ", "3000")),
    # Compiles are cheap but contend for a shared, circuit-broken worker pool.
    "compile": int(os.getenv("OHMLET_QUOTA_COMPILE", "1000")),
}


def _period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def _doc_id(uid: str, action: str) -> str:
    return f"{uid}:{action}:{_period()}"


def enforce(uid: str, action: str, limit: int | None = None) -> int:
    """Count one use of `action` for `uid`, or raise 429 if the month is spent.

    Returns the count AFTER this call, so a caller can surface "you have used
    N of M" if it ever wants to. Raises HTTPException(429) when the ceiling is
    already reached.
    """
    cap = DEFAULT_LIMITS.get(action, 0) if limit is None else limit
    if cap <= 0:
        return 0

    try:
        from google.cloud import firestore

        client = firestore.Client()
        ref = client.collection(QUOTA_COLLECTION).document(_doc_id(uid, action))

        @firestore.transactional
        def _bump(txn: firestore.Transaction) -> int:
            snap = ref.get(transaction=txn)
            used = int((snap.to_dict() or {}).get("used", 0)) if snap.exists else 0
            if used >= cap:
                return -1
            txn.set(ref, {"uid": uid, "action": action, "period": _period(), "used": used + 1})
            return used + 1

        result = _bump(client.transaction())
    except Exception as exc:
        # Loud, and then allow. See the note on failing open at the top.
        logger.warning("quota check failed for %s/%s, allowing: %s", uid, action, exc)
        return 0

    if result < 0:
        logger.warning("quota exhausted uid=%s action=%s cap=%s", uid, action, cap)
        raise HTTPException(
            status_code=429,
            detail="You have made an unusual number of requests this month. Get in touch if this is wrong.",
        )
    return result


def status(uid: str) -> dict[str, Any]:
    """What this identity has used this month, for support and for tests."""
    out: dict[str, Any] = {"period": _period(), "actions": {}}
    try:
        from google.cloud import firestore

        client = firestore.Client()
        for action, cap in DEFAULT_LIMITS.items():
            snap = client.collection(QUOTA_COLLECTION).document(_doc_id(uid, action)).get()
            used = int((snap.to_dict() or {}).get("used", 0)) if snap.exists else 0
            out["actions"][action] = {"used": used, "limit": cap}
    except Exception as exc:
        logger.warning("quota status failed for %s: %s", uid, exc)
    return out
