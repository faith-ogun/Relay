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

from fastapi import APIRouter, HTTPException
from google.api_core import exceptions as gcloud_exceptions
from google.cloud import firestore

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


@router.get("/{user_id}")
def load_state(user_id: str) -> dict[str, Any]:
    """Return the persisted state envelope for a user, or {} if none exists."""
    user_id = user_id.strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    try:
        snapshot = _doc_ref(user_id).get()
    except gcloud_exceptions.GoogleAPICallError as exc:
        logger.error("Firestore load failed for %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="State backend unavailable") from exc
    if not snapshot.exists:
        return {}
    return snapshot.to_dict() or {}


@router.put("/{user_id}")
def save_state(user_id: str, payload: dict[str, Any]) -> dict[str, str]:
    """Upsert the persisted state envelope for a user."""
    user_id = user_id.strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="payload must be a JSON object")
    try:
        _doc_ref(user_id).set(payload)
    except gcloud_exceptions.GoogleAPICallError as exc:
        logger.error("Firestore save failed for %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="State backend unavailable") from exc
    return {"status": "ok"}
