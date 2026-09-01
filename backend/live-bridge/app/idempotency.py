"""Idempotency + concurrency safety (#51).

Two primitives that make retried or racing writes safe:

  1. claim_event(key): a Firestore transaction that succeeds exactly once per
     key. The first caller "claims" the event and returns True; every later
     caller (a retry, a duplicate Stripe webhook delivery) returns False. This
     is what makes the Stripe webhook (#30) safe to receive twice, and any
     at-least-once delivery safe to process at-most-once.

  2. save_state_if_newer(...): an optimistic-concurrency write for one keyed
     user-state record. Two tabs/devices saving at once would otherwise blindly
     clobber each other (last write wins, possibly with stale data). This reads
     and writes inside one transaction and skips a write whose `updatedAt` is
     strictly older than what is already stored.

     Note the scope: the transaction protects one RECORD against a racing write
     of the SAME record. It never protected one record against another, because
     before keying every record shared a document and `txn.set` is a full
     replace. Isolation between records is `state_store`'s keyed layout; this is
     only the guard within a key.

  3. migrate_legacy_key(...): carve one keyed record out of a pre-keying
     document, atomically and exactly once.

The live BUDGET path is already race-safe via firestore.Increment in
entitlements.add_live_seconds, so it needs nothing here.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from google.cloud import firestore

logger = logging.getLogger("ohmlet.idempotency")

EVENTS_COLLECTION = os.getenv("OHMLET_EVENTS_COLLECTION", "ohmlet_idempotency")


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
    except Exception as exc:
        # Fail LOUD, never silently "already handled". Returning False here would
        # make the caller ack a Stripe event we never processed, and Stripe would
        # not retry: the customer pays and is never upgraded. Raising makes the
        # webhook 5xx so the delivery is retried.
        logger.error("idempotency claim errored for %s: %s", key, exc)
        raise


def release_event(key: str) -> None:
    """Undo a claim so a failed-but-claimed event can be retried (best-effort)."""
    if not key or not key.strip():
        return
    from state_store import get_client  # lazy: avoids a circular import at module load

    try:
        get_client().collection(EVENTS_COLLECTION).document(key.strip()).delete()
    except Exception as exc:
        logger.warning("idempotency release failed for %s: %s", key, exc)


def save_state_if_newer(user_id: str, payload: dict[str, Any], key: str | None = None) -> bool:
    """Write one keyed state record unless a strictly-newer one is stored.

    Returns True if written, False if skipped as stale. Uses a transaction so
    the read-compare-write is atomic against a concurrent save of the same key.
    `key` defaults to the record kept at the parent document (`progress`)."""
    from state_store import DEFAULT_STATE_KEY, get_client, record_ref  # lazy: avoids a circular import at module load

    client = get_client()
    ref = record_ref(user_id, key or DEFAULT_STATE_KEY)
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


def migrate_legacy_key(
    user_id: str,
    key: str,
    carve: Callable[[dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    """Carve one keyed record out of a pre-keying `ohmlet_state/{uid}` document.

    Returns the migrated envelope, or {} when there is nothing to carve.

    `carve` maps the legacy document's `data` to the slice that belongs to this
    key. It is supplied by `state_store`, which owns every judgement about
    shape; this module stays shape-blind and only guarantees the transaction.

    Three properties this has to hold, in order of how much they matter:

      * It never invents data. Only fields actually present in the parent
        document are copied, so a learner whose record was already destroyed
        before keying shipped gets an empty record, not a fabricated one.
      * It is not destructive. The fields stay in the parent document as well.
        Stripping them would strand any pre-keying client still reading the
        unkeyed path: it would rehydrate zeroed counters and save them back.
        The copy is inert for new clients, which read the keyed record.
      * It happens once. The whole read-compare-write runs in a transaction and
        does nothing if the keyed record already exists, so a request racing a
        save cannot overwrite the newer record with the legacy copy.
    """
    from state_store import DEFAULT_STATE_KEY, get_client, record_ref  # lazy: avoids a circular import at module load

    client = get_client()
    key_ref = record_ref(user_id, key)
    parent_ref = record_ref(user_id, DEFAULT_STATE_KEY)

    @firestore.transactional
    def _migrate(txn: firestore.Transaction) -> tuple[dict[str, Any], bool]:
        key_snap = key_ref.get(transaction=txn)
        if key_snap.exists:
            return key_snap.to_dict() or {}, False
        parent_snap = parent_ref.get(transaction=txn)
        if not parent_snap.exists:
            return {}, False
        parent = parent_snap.to_dict() or {}
        data = parent.get("data")
        if not isinstance(data, dict):
            return {}, False
        carved = carve(data)
        if not carved:
            return {}, False
        updated_at = parent.get("updatedAt")
        envelope: dict[str, Any] = {
            "version": parent.get("version", 1),
            "data": carved,
            # The legacy timestamp, not now(). Stamping the migration time would
            # make this copy look newer than a save already in flight from the
            # client that owns the record.
            "updatedAt": updated_at if isinstance(updated_at, str) else "",
            "migratedFrom": "legacy-unkeyed-document",
        }
        txn.set(key_ref, envelope)
        return envelope, True

    try:
        migrated, carved_now = _migrate(client.transaction())
    except Exception as exc:
        # A failed migration must not fail the read. The caller falls back to an
        # empty record and the client's local copy, and the next read retries.
        logger.error("legacy state migration failed for %s/%s: %s", user_id, key, exc)
        return {}
    if carved_now:
        logger.info("migrated legacy state for %s into key %s", user_id, key)
    return migrated
