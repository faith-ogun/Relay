"""Twin storage + records (#31).

The mesh (a .glb binary) lives in Cloud Storage; its metadata lives in Firestore,
scoped to the owner's uid (same isolation contract as #44). The GLB is never made
public — it is streamed back through the authenticated `/v1/twins/{id}/model`
endpoint after an ownership check, so a twin is as private as the rest of a user's
data.

Clients are built lazily and cached so we don't pay construction per request.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

logger = logging.getLogger("ohmlet.reporter.storage")

TWINS_BUCKET = os.getenv("OHMLET_TWINS_BUCKET", "ohmlet-app-twins")
TWINS_COLLECTION = os.getenv("OHMLET_TWINS_COLLECTION", "ohmlet_twins")
GLB_CONTENT_TYPE = "model/gltf-binary"


@lru_cache(maxsize=1)
def _storage_client():
    from google.cloud import storage

    return storage.Client()


@lru_cache(maxsize=1)
def _bucket():
    return _storage_client().bucket(TWINS_BUCKET)


@lru_cache(maxsize=1)
def _firestore():
    from google.cloud import firestore

    return firestore.Client()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _blob_path(uid: str, twin_id: str) -> str:
    # Partition by uid so a bucket-level mishap is still owner-scoped, and listing
    # a user's objects is a cheap prefix query.
    return f"twins/{uid}/{twin_id}.glb"


# ── Mesh bytes (GCS) ──
def upload_glb(uid: str, twin_id: str, glb: bytes) -> int:
    blob = _bucket().blob(_blob_path(uid, twin_id))
    blob.upload_from_string(glb, content_type=GLB_CONTENT_TYPE)
    return len(glb)


def download_glb(uid: str, twin_id: str) -> Optional[bytes]:
    blob = _bucket().blob(_blob_path(uid, twin_id))
    if not blob.exists():
        return None
    return blob.download_as_bytes()


def delete_glb(uid: str, twin_id: str) -> None:
    blob = _bucket().blob(_blob_path(uid, twin_id))
    try:
        blob.delete()
    except Exception as exc:  # already gone is fine
        logger.info("glb delete no-op for %s/%s: %s", uid, twin_id, exc)


# ── Metadata (Firestore) ──
def create_record(uid: str, twin_id: str, fields: dict) -> dict:
    doc = {
        "id": twin_id,
        "uid": uid,
        "status": "processing",
        "createdAt": _now(),
        **fields,
    }
    _firestore().collection(TWINS_COLLECTION).document(twin_id).set(doc)
    return doc


def update_record(twin_id: str, fields: dict) -> None:
    _firestore().collection(TWINS_COLLECTION).document(twin_id).set(
        {**fields, "updatedAt": _now()}, merge=True
    )


def get_record(uid: str, twin_id: str) -> Optional[dict]:
    snap = _firestore().collection(TWINS_COLLECTION).document(twin_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    # Ownership check is the caller's gate to a private artifact (#44).
    if data.get("uid") != uid:
        return None
    return data


def list_records(uid: str, limit: int = 50) -> list[dict]:
    from google.cloud.firestore_v1.base_query import FieldFilter

    col = _firestore().collection(TWINS_COLLECTION)
    rows = [
        snap.to_dict() or {}
        for snap in col.where(filter=FieldFilter("uid", "==", uid)).limit(limit).stream()
    ]
    rows.sort(key=lambda r: r.get("createdAt", ""), reverse=True)
    return rows


def delete_record(twin_id: str) -> None:
    _firestore().collection(TWINS_COLLECTION).document(twin_id).delete()


def count_for_period(uid: str, period: str) -> int:
    """How many twins this user has created in the given YYYY-MM window. Used for
    the per-tier monthly quota."""
    from google.cloud.firestore_v1.base_query import FieldFilter

    col = _firestore().collection(TWINS_COLLECTION)
    n = 0
    for snap in col.where(filter=FieldFilter("uid", "==", uid)).stream():
        d = snap.to_dict() or {}
        if str(d.get("createdAt", "")).startswith(period) and d.get("status") != "failed":
            n += 1
    return n
