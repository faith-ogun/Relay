"""Ohmlet user-state persistence — server-side Firestore access.

The frontend used to write to Firestore directly with a browser API key, which
meant the only rules that let it work were effectively wide-open. This module
moves persistence behind the service: the browser talks to our API, and the API
talks to Firestore using the service account (Application Default Credentials on
Cloud Run; `gcloud auth application-default login` locally). Firestore client
rules can then deny all direct browser access — the Admin SDK bypasses them.

State is KEYED. Every caller names the record it owns, and records never share a
document:

    ohmlet_state/{uid}                  the default key, `progress`
    ohmlet_state/{uid}/keys/{key}       every other key, one document each

Before keying existed, three callers (the web workspace's `progress`, the web
achievements page's `metrics`, and the mobile app) all wrote the whole of
`ohmlet_state/{uid}`, and the write is a full replace. Whichever surface saved
last owned the document and the other two records were destroyed. That is
resolved here, not in the clients: see `classify_legacy_payload` and
`legacy_view` for how already-installed clients keep working.

Each record is an opaque envelope (`{version, data, updatedAt}`) owned by its
client. This layer interprets `data` in exactly one place, `carve_legacy_record`
(with `KEY_FIELDS` and `NESTED_KEY_SOURCES`), and only to split a pre-keying
document into the right records.

Kept self-contained (its own router + lazy client) so it can be lifted into a
dedicated `state` Cloud Run service later without touching the live agent.
"""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from google.api_core import exceptions as gcloud_exceptions
from google.cloud import firestore

from auth import require_uid
from validation import validate_state_envelope
from idempotency import migrate_legacy_key, save_state_if_newer

logger = logging.getLogger("ohmlet.state-store")

STATE_COLLECTION = os.getenv("OHMLET_STATE_COLLECTION", "ohmlet_state")

# The key stored at the PARENT document rather than in the `keys` subcollection.
#
# This is the whole of the backward-compatibility story and is not arbitrary.
# `ohmlet_state/{uid}` is the pre-keying document, and two things still depend
# on it holding the progress record: `checkpoints._completed_lessons`, which
# reads `data.lessonLevels` straight out of Firestore, and the mobile build
# already installed on people's phones, which PUTs its Progress shape to the
# unkeyed path. Declaring `progress` the default key means both keep working
# with no migration and no rewrite.
DEFAULT_STATE_KEY = "progress"

KEYS_SUBCOLLECTION = os.getenv("OHMLET_STATE_KEYS_SUBCOLLECTION", "keys")

# An authenticated client could otherwise mint unbounded 200 KB documents under
# its own uid. The cap is an abuse ceiling, not a correctness invariant, so it
# is checked outside the write transaction.
MAX_STATE_KEYS = int(os.getenv("OHMLET_MAX_STATE_KEYS", "16"))

# Firestore document ids may not be `.`, `..` or contain `/`. This is stricter
# than that on purpose: keys are ours, short, and lowercase.
_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{0,39}$")

# ── Shape ownership, for legacy documents only ────────────────────────────────
#
# A document written before keying holds whichever record happened to be saved
# last, or (commonly) a UNION of two: the web hooks hydrate from the shared
# document into their own defaults and save the merge back, so progress fields
# and metric fields end up side by side.
#
# Identification is by field name, never by guessing:
#
#   * `metrics` owns the nine MetricCounters names and nothing else.
#   * `progress` is the DEFAULT and therefore the catch-all: any field that is
#     not owned by a named key belongs to it. That is why PROGRESS_FIELDS is
#     used only as a negative signal (to tell "this is a metrics record" apart
#     from "this is a union"), never to decide what progress keeps.
#
# Ambiguity (both sets present) is resolved without loss: the document stays the
# progress record and the metric fields are COPIED to the metrics record. The
# carve is never destructive. Removing the fields from the parent document would
# break any pre-keying client still reading the unkeyed path, which would
# rehydrate zeroed counters and save them back over the good ones.
METRICS_FIELDS = frozenset({
    "liveSessions", "drawings", "perfect", "twins", "posts",
    "comments", "challenges", "leagueWins", "lastLeagueWeek",
})

PROGRESS_FIELDS = frozenset({
    "lessonLevels", "xp", "streak", "completedToday",
    "lastActiveDate", "completedLessonIds",
})

KEY_FIELDS: dict[str, frozenset[str]] = {"metrics": METRICS_FIELDS}

# Where a key's fields hide when a legacy client nested them instead of writing
# them at the top level. The mobile build already installed on people's phones
# PUTs its counters as `data.metrics`, so a top-level-only carve finds nothing
# and the achievements page shows a mobile-only learner zeroes for counters the
# server is holding one level down. Read only when the top-level carve is empty,
# and only by the migration, which never runs once the record exists.
NESTED_KEY_SOURCES: dict[str, str] = {"metrics": "metrics"}

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


def normalize_key(key: str | None) -> str:
    """Validate a client-supplied record key, defaulting to `progress`."""
    candidate = (key or "").strip().lower()
    if not candidate:
        return DEFAULT_STATE_KEY
    if not _KEY_PATTERN.match(candidate):
        raise HTTPException(status_code=400, detail="Invalid state key.")
    return candidate


def _doc_ref(user_id: str) -> firestore.DocumentReference:
    return _client().collection(STATE_COLLECTION).document(user_id)


def record_ref(user_id: str, key: str = DEFAULT_STATE_KEY) -> firestore.DocumentReference:
    """The document holding one keyed record. Also used by `idempotency`."""
    parent = _doc_ref(user_id)
    if key == DEFAULT_STATE_KEY:
        return parent
    return parent.collection(KEYS_SUBCOLLECTION).document(key)


def _authorize(path_user_id: str, caller_uid: str) -> str:
    """A user may only touch their own document. The doc id is the verified UID
    from the token, never the (spoofable) path param — and a mismatch is a hard
    403 so a stale or tampered URL cannot reach someone else's data."""
    path_user_id = (path_user_id or "").strip()
    if path_user_id and path_user_id != caller_uid:
        logger.warning("Cross-user state access blocked: path=%s caller=%s", path_user_id, caller_uid)
        raise HTTPException(status_code=403, detail="You can only access your own data")
    return caller_uid


def _envelope_data(envelope: Any) -> dict[str, Any]:
    """The `data` object of an envelope, or {} if it is absent or not an object."""
    if not isinstance(envelope, dict):
        return {}
    data = envelope.get("data")
    return data if isinstance(data, dict) else {}


def classify_legacy_payload(payload: dict[str, Any]) -> tuple[str, dict[str, dict[str, Any]]]:
    """Decide which record an UNKEYED (pre-keying client) write belongs to.

    Returns `(target_key, fan_out)` where `fan_out` maps additional keys to the
    slice of `data` that should be mirrored into them.

    The discriminator is deliberately narrow. A progress record always carries
    its own defaults (xp, streak, lessonLevels, completedToday, lastActiveDate),
    so "metric fields present AND no progress field present" cannot be anything
    but the achievements page's record. Anything else stays the default record,
    which is what keeps the installed mobile build writing where it always did.
    """
    data = _envelope_data(payload)
    metric_fields = {k: v for k, v in data.items() if k in METRICS_FIELDS}
    if metric_fields and not (data.keys() & PROGRESS_FIELDS):
        return "metrics", {}
    if metric_fields:
        # A union. It stays the progress record (unstripped, so old clients keep
        # reading it) and the metric half is mirrored into its own record.
        return DEFAULT_STATE_KEY, {"metrics": metric_fields}
    return DEFAULT_STATE_KEY, {}


def carve_legacy_record(key: str, data: dict[str, Any]) -> dict[str, Any]:
    """The slice of a pre-keying document's `data` that belongs to `key`.

    Top level first, because that is what the web hooks wrote. Only if that
    finds nothing do we look inside `NESTED_KEY_SOURCES[key]`, which is where
    the installed mobile build put the same counters. Preferring the top level
    means a document holding both (a learner who used web and phone) migrates
    the web copy and leaves the phone's nested copy where the phone reads it.
    """
    owned = KEY_FIELDS.get(key)
    if not owned:
        return {}
    carved = {k: v for k, v in data.items() if k in owned}
    if carved:
        return carved
    nested = data.get(NESTED_KEY_SOURCES.get(key, ""))
    if isinstance(nested, dict):
        return {k: v for k, v in nested.items() if k in owned}
    return {}


def _carve_known_keys(user_id: str) -> None:
    """Split every known key out of the pre-keying document before a write
    replaces it.

    The default key IS the pre-keying document, so saving `progress` overwrites
    whatever the learner's legacy record held, achievement counters included.
    Migrating only on a read of `metrics` left the order to the client: a
    surface that saved progress before anything asked for the counters erased
    the only copy of them. Carving here makes it the server's invariant instead
    — nothing can replace that document until its other records are safely out.

    Costs one extra document read per progress save; `migrate_legacy_key`
    returns on the keyed record already existing, which after the first save is
    always.
    """
    for key in KEY_FIELDS:
        migrate_legacy_key(user_id, key, lambda data, k=key: carve_legacy_record(k, data))


def load_record(user_id: str, key: str) -> dict[str, Any]:
    """One keyed record, migrating it out of a pre-keying document on demand.

    Migration is lazy rather than a batch job. This service scales to zero, so a
    one-shot script would have to be run by hand against production while old
    clients were still writing, and a document migrated at 10:00 could be
    clobbered again at 10:01 by a client that had not reloaded. A read-path
    migration is idempotent, runs inside a transaction against concurrent
    writes, and still fires for a learner who comes back in six months.

    Cost: one extra document read the first time a key is requested for a user
    who predates keying. After the client's next save the record exists and the
    extra read stops.
    """
    key = normalize_key(key)
    snapshot = record_ref(user_id, key).get()
    if snapshot.exists:
        return snapshot.to_dict() or {}
    if key == DEFAULT_STATE_KEY:
        return {}
    if key not in KEY_FIELDS:
        # A key with no legacy footprint (anything added after keying) has
        # nothing to migrate: an absent document simply means nothing stored.
        return {}
    return migrate_legacy_key(user_id, key, lambda data: carve_legacy_record(key, data)) or {}


def legacy_view(user_id: str) -> dict[str, Any]:
    """The unkeyed document as a pre-keying client expects to see it.

    Old clients read the whole record set from one path, so this overlays every
    keyed record onto the parent document. Without it, a browser tab left open
    across the deploy would hydrate zeroed counters from a parent document that
    no longer carries them and save the zeros back.

    Keyed records win over the parent's stale copy of the same field, and the
    reported `updatedAt` is the newest of everything merged.
    """
    parent = _doc_ref(user_id)
    snapshot = parent.get()
    base = (snapshot.to_dict() or {}) if snapshot.exists else {}

    if snapshot.exists and "data" in base and not isinstance(base.get("data"), dict):
        # `data` may legitimately be a list. There is no field-wise merge for
        # that, so the parent record is returned untouched.
        return base

    data = dict(_envelope_data(base))
    updated_at = base.get("updatedAt") if isinstance(base.get("updatedAt"), str) else ""
    found_key_record = False

    for record in parent.collection(KEYS_SUBCOLLECTION).stream():
        found_key_record = True
        envelope = record.to_dict() or {}
        data.update(_envelope_data(envelope))
        candidate = envelope.get("updatedAt")
        if isinstance(candidate, str) and candidate > updated_at:
            updated_at = candidate

    if not snapshot.exists and not found_key_record:
        return {}

    # Built ON the stored document rather than from scratch: a legacy record
    # whose top level is not exactly {version, data, updatedAt} would otherwise
    # come back with those extra fields silently dropped, and the pre-keying
    # client reading this path would hydrate the gap and save it back.
    view: dict[str, Any] = dict(base)
    view["version"] = base.get("version", 1)
    view["data"] = data
    if updated_at:
        view["updatedAt"] = updated_at
    return view


def _key_budget_ok(user_id: str, key: str) -> bool:
    """True if writing `key` would not exceed the per-user key ceiling."""
    if key == DEFAULT_STATE_KEY:
        return True
    try:
        existing = {ref.id for ref in _doc_ref(user_id).collection(KEYS_SUBCOLLECTION).list_documents()}
    except gcloud_exceptions.GoogleAPICallError as exc:
        # Failing the count must not fail a legitimate save of a key that
        # already exists; the ceiling is an abuse guard, not an invariant.
        logger.warning("key count failed for %s: %s", user_id, exc)
        return True
    return key in existing or len(existing) < MAX_STATE_KEYS


def _save_record(user_id: str, key: str, payload: dict[str, Any]) -> bool:
    """Validate and write one keyed record. Returns False if it was stale."""
    payload = validate_state_envelope(payload)
    if not _key_budget_ok(user_id, key):
        raise HTTPException(status_code=429, detail="Too many state keys for this account.")
    if key == DEFAULT_STATE_KEY:
        # This write REPLACES the pre-keying document. Anything still only
        # stored there has to be carved out first or it goes with it.
        _carve_known_keys(user_id)
    return save_state_if_newer(user_id, payload, key=key)


@router.get("/{user_id}")
def load_state(user_id: str, caller_uid: str = Depends(require_uid)) -> dict[str, Any]:
    """Compatibility read for clients that predate keyed records.

    Returns every record merged into the single envelope those clients expect,
    or {} if the user has none. New clients use `/v1/state/{uid}/{key}`.
    """
    uid = _authorize(user_id, caller_uid)
    try:
        return legacy_view(uid)
    except gcloud_exceptions.GoogleAPICallError as exc:
        logger.error("Firestore load failed for %s: %s", uid, exc)
        raise HTTPException(status_code=502, detail="State backend unavailable") from exc


@router.put("/{user_id}")
def save_state(user_id: str, payload: dict[str, Any], caller_uid: str = Depends(require_uid)) -> dict[str, str]:
    """Compatibility write for clients that predate keyed records.

    The payload is routed to the record its shape identifies rather than being
    written over the whole document, which is what stopped one surface from
    destroying another's data. Validates + size-caps the payload (#45) and
    writes with optimistic concurrency so a stale tab cannot clobber a newer
    save (#51).
    """
    uid = _authorize(user_id, caller_uid)
    target, fan_out = classify_legacy_payload(payload)
    try:
        written = _save_record(uid, target, payload)
    except gcloud_exceptions.GoogleAPICallError as exc:
        logger.error("Firestore save failed for %s: %s", uid, exc)
        raise HTTPException(status_code=502, detail="State backend unavailable") from exc

    for key, slice_ in fan_out.items():
        mirror = {"version": payload.get("version", 1), "data": slice_}
        if isinstance(payload.get("updatedAt"), str):
            mirror["updatedAt"] = payload["updatedAt"]
        try:
            _save_record(uid, key, mirror)
        except (gcloud_exceptions.GoogleAPICallError, HTTPException) as exc:
            # The fan-out is a mirror: the same fields were just written to the
            # parent document and `legacy_view` still serves them, so a failure
            # here costs freshness on the keyed read, never data.
            logger.warning("state fan-out to %s failed for %s: %s", key, uid, exc)

    return {"status": "ok" if written else "stale", "key": target}


@router.get("/{user_id}/{key}")
def load_state_key(user_id: str, key: str, caller_uid: str = Depends(require_uid)) -> dict[str, Any]:
    """Return one keyed record for the signed-in user, or {} if none."""
    uid = _authorize(user_id, caller_uid)
    try:
        return load_record(uid, key)
    except gcloud_exceptions.GoogleAPICallError as exc:
        logger.error("Firestore load failed for %s/%s: %s", uid, key, exc)
        raise HTTPException(status_code=502, detail="State backend unavailable") from exc


@router.put("/{user_id}/{key}")
def save_state_key(
    user_id: str,
    key: str,
    payload: dict[str, Any],
    caller_uid: str = Depends(require_uid),
) -> dict[str, str]:
    """Upsert one keyed record. Records are isolated, so two surfaces saving
    different keys at the same moment cannot overwrite each other."""
    uid = _authorize(user_id, caller_uid)
    record_key = normalize_key(key)
    try:
        written = _save_record(uid, record_key, payload)
    except gcloud_exceptions.GoogleAPICallError as exc:
        logger.error("Firestore save failed for %s/%s: %s", uid, record_key, exc)
        raise HTTPException(status_code=502, detail="State backend unavailable") from exc
    return {"status": "ok" if written else "stale", "key": record_key}
