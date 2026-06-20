"""Idempotency + concurrency safety (#51).

Two primitives that make retried or racing writes safe:

  1. claim_event(key) — a Firestore transaction that succeeds exactly once per
     key. The first caller "claims" the event and returns True; every later
     caller (a retry, a duplicate Stripe webhook delivery) returns False. This
     is what makes the Stripe webhook (#30) safe to receive twice, and any
     at-least-once delivery safe to process at-most-once.

  2. save_state_if_newer(...) — an optimistic-concurrency write for the user
     state envelope. Two tabs/devices saving at once would otherwise blindly
     clobber each other (last write wins, possibly with stale data). This reads
     and writes inside one transaction and skips a write whose `updatedAt` is
     strictly older than what is already stored.

The live BUDGET path is already race-safe via firestore.Increment in
entitlements.add_live_seconds, so it needs nothing here.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

from google.cloud import firestore

logger = logging.getLogger("ohmlet.idempotency")

EVENTS_COLLECTION = os.getenv("OHMLET_EVENTS_COLLECTION", "ohmlet_idempotency")
STATE_COLLECTION = os.getenv("OHMLET_STATE_COLLECTION", "ohmlet_state")


def claim_event(key: str) -> bool:
    """Atomically claim a one-time event key. True if this is the first time we
    have seen it, False if it was already processed (a duplicate/retry)."""
    if not key or not key.strip():
        return True  # nothing to dedupe on; let the caller proceed
    from state_store import get_client  # lazy: avoids a circular import at module load

    client = get_client()
    ref = client.collection(EVENTS_COLLECTION).document(key.strip())

    @firestore.transactional
    def _claim(txn: firestore.Transaction) -> bool:
        snap = ref.get(transaction=txn)
        if snap.exists:
            return False
        txn.set(ref, {"claimed_at": datetime.now(timezone.utc).isoformat()})
        return True

    try:
        return _claim(client.transaction())
    except Exception as exc:  # on infra error, do not double-process
        logger.warning("idempotency claim failed for %s: %s", key, exc)
        return False


def save_state_if_newer(user_id: str, payload: dict[str, Any]) -> bool:
    """Write the state envelope unless a strictly-newer one is already stored.

    Returns True if written, False if skipped as stale. Uses a transaction so
    the read-compare-write is atomic against a concurrent save."""
    from state_store import get_client  # lazy: avoids a circular import at module load

    client = get_client()
    ref = client.collection(STATE_COLLECTION).document(user_id)
    incoming = payload.get("updatedAt") if isinstance(payload, dict) else None

    @firestore.transactional
    def _save(txn: firestore.Transaction) -> bool:
        snap = ref.get(transaction=txn)
        if snap.exists and isinstance(incoming, str):
            existing = (snap.to_dict() or {}).get("updatedAt")
            # Both ISO-8601, so lexical compare == chronological compare.
            if isinstance(existing, str) and existing > incoming:
                return False  # stored copy is newer; do not clobber
        txn.set(ref, payload)
        return True

    return _save(client.transaction())
