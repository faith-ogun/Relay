"""Ohmlet user-state persistence — server-side Firestore access.

The frontend used to write to Firestore directly with a browser API key, which
meant the only rules that let it work were effectively wide-open. This module
moves persistence behind the service: the browser talks to our API, and the API
talks to Firestore using the service account (Application Default Credentials on
Cloud Run; `gcloud auth application-default login` locally). Firestore client
rules can then deny all direct browser access — the Admin SDK bypasses them.

State lives as one document per user under the `ohmlet_state` collection. The
document is an opaque envelope (`{version, data, updatedAt}`) owned by the
frontend; this layer does not interpret its contents.

Kept self-contained (its own router + lazy client) so it can be lifted into a
dedicated `state` Cloud Run service later without touching the live agent.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from google.api_core import exceptions as gcloud_exceptions
from google.cloud import firestore

from auth import require_uid
from validation import validate_state_envelope
from idempotency import save_state_if_newer

logger = logging.getLogger("ohmlet.state-store")

STATE_COLLECTION = os.getenv("OHMLET_STATE_COLLECTION", "ohmlet_state")

router = APIRouter(prefix="/v1/state", tags=["state"])


@lru_cache(maxsize=1)
def _client() -> firestore.Client:
    """Lazily build a Firestore client bound to the Ohmlet project.

    Cached so we reuse one client across requests. Credentials resolve via ADC:
    the Cloud Run service account in production, your gcloud login locally.
    """
    project = os.getenv("GOOGLE_CLOUD_PROJECT", "ohmlet-app")
    return firestore.Client(project=project)


def get_client() -> firestore.Client:
    """Shared Firestore client (reused across modules, e.g. usage metering)."""
    return _client()


def _doc_ref(user_id: str) -> firestore.DocumentReference:
    return _client().collection(STATE_COLLECTION).document(user_id)


def _authorize(path_user_id: str, caller_uid: str) -> str:
    """A user may only touch their own document. The doc id is the verified UID
    from the token, never the (spoofable) path param — and a mismatch is a hard
    403 so a stale or tampered URL cannot reach someone else's data."""
    path_user_id = (path_user_id or "").strip()
    if path_user_id and path_user_id != caller_uid:
        logger.warning("Cross-user state access blocked: path=%s caller=%s", path_user_id, caller_uid)
        raise HTTPException(status_code=403, detail="You can only access your own data")
    return caller_uid


@router.get("/{user_id}")
def load_state(user_id: str, caller_uid: str = Depends(require_uid)) -> dict[str, Any]:
    """Return the persisted state envelope for the signed-in user, or {} if none."""
    uid = _authorize(user_id, caller_uid)
    try:
        snapshot = _doc_ref(uid).get()
    except gcloud_exceptions.GoogleAPICallError as exc:
        logger.error("Firestore load failed for %s: %s", uid, exc)
        raise HTTPException(status_code=502, detail="State backend unavailable") from exc
    if not snapshot.exists:
        return {}
    return snapshot.to_dict() or {}


@router.put("/{user_id}")
def save_state(user_id: str, payload: dict[str, Any], caller_uid: str = Depends(require_uid)) -> dict[str, str]:
    """Upsert the persisted state envelope for the signed-in user.

    Validates + size-caps the payload (#45) and writes with optimistic
    concurrency so a stale tab cannot clobber a newer save (#51)."""
    uid = _authorize(user_id, caller_uid)
    payload = validate_state_envelope(payload)
    try:
        written = save_state_if_newer(uid, payload)
    except gcloud_exceptions.GoogleAPICallError as exc:
        logger.error("Firestore save failed for %s: %s", uid, exc)
        raise HTTPException(status_code=502, detail="State backend unavailable") from exc
    return {"status": "ok" if written else "stale"}
