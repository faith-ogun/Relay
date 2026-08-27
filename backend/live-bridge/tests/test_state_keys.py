"""Keyed user state: two surfaces must not be able to destroy each other's data.

The bug these cover was live in production and only visible across devices.
Three callers persisted three incompatible shapes (the workspace's `progress`,
the achievements page's `metrics`, and the mobile app's Progress), the `key`
namespaced localStorage only, and every one of them PUT the same document. The
Firestore write is `txn.set`, a full replace. So whichever surface saved last
owned the document and the other records were gone: a learner's XP, streak and
lesson levels could be destroyed by opening the achievements page, or by picking
up their phone.

What has to hold now:

  * records with different keys are different documents and both survive;
  * a document written before keying is carved into the right record, without
    guessing and without being destroyed in the process;
  * the clients that predate keying (an installed mobile build, a browser tab
    left open across the deploy) keep working and cannot clobber a migrated
    record.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

import idempotency
import privacy
import state_store
import validation


# ── A Firestore stand-in with real subcollection semantics ───────────────────
#
# Paths are stored flat ("ohmlet_state/u1", "ohmlet_state/u1/keys/metrics") so
# the parent/child relationship the fix depends on is modelled honestly rather
# than assumed.

class FakeSnapshot:
    def __init__(self, path: str, data: dict | None):
        self.id = path.rsplit("/", 1)[-1]
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class FakeDocRef:
    def __init__(self, store: dict, path: str):
        self._store = store
        self.path = path
        self.id = path.rsplit("/", 1)[-1]

    def get(self, transaction=None):
        return FakeSnapshot(self.path, self._store.get(self.path))

    def set(self, data):
        self._store[self.path] = dict(data)

    def delete(self):
        self._store.pop(self.path, None)

    def collection(self, name):
        return FakeCollectionRef(self._store, f"{self.path}/{name}")


class FakeCollectionRef:
    def __init__(self, store: dict, path: str):
        self._store = store
        self.path = path

    def document(self, doc_id):
        return FakeDocRef(self._store, f"{self.path}/{doc_id}")

    def _child_paths(self):
        prefix = f"{self.path}/"
        return sorted(p for p in self._store if p.startswith(prefix) and "/" not in p[len(prefix):])

    def stream(self):
        for path in self._child_paths():
            yield FakeSnapshot(path, self._store[path])

    def list_documents(self):
        for path in self._child_paths():
            yield FakeDocRef(self._store, path)


class FakeTransaction:
    """Enough of a transaction for the read-compare-write primitives.

    Serial, so it cannot model contention; what it does model is that the write
    goes to the reference it is given rather than to a whole document.
    """

    def __init__(self, store: dict):
        self._store = store

    def set(self, ref: FakeDocRef, data: dict):
        ref.set(data)


class FakeClient:
    def __init__(self):
        self.store: dict[str, dict] = {}

    def collection(self, name):
        return FakeCollectionRef(self.store, name)

    def transaction(self):
        return FakeTransaction(self.store)


@pytest.fixture
def db(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(state_store, "_client", lambda: client)
    monkeypatch.setattr(state_store, "get_client", lambda: client)
    # `@firestore.transactional` is applied at call time inside the primitives,
    # so replacing it with identity lets them run against FakeTransaction.
    monkeypatch.setattr(idempotency.firestore, "transactional", lambda fn: fn)
    return client


UID = "learner-1"
ROOT = f"ohmlet_state/{UID}"
METRICS_DOC = f"{ROOT}/keys/metrics"

PROGRESS_DATA = {
    "lessonLevels": {"ohms-law": 3, "ldr-alarm": 2},
    "xp": 4200,
    "streak": 17,
    "completedToday": 2,
    "lastActiveDate": "2026-08-26",
}

METRICS_DATA = {
    "liveSessions": 9, "drawings": 4, "perfect": 6, "twins": 2, "posts": 3,
    "comments": 11, "challenges": 1, "leagueWins": 2, "lastLeagueWeek": "2026-W34",
}


def envelope(data: dict, updated_at: str) -> dict:
    return {"version": 1, "data": data, "updatedAt": updated_at}


# ── The headline: two surfaces, two keys, both survive ──────────────────────

def test_two_surfaces_writing_different_keys_both_survive(db):
    state_store.save_state_key(UID, "progress", envelope(PROGRESS_DATA, "2026-08-26T10:00:00Z"), caller_uid=UID)
    state_store.save_state_key(UID, "metrics", envelope(METRICS_DATA, "2026-08-26T10:00:01Z"), caller_uid=UID)

    progress = state_store.load_state_key(UID, "progress", caller_uid=UID)
    metrics = state_store.load_state_key(UID, "metrics", caller_uid=UID)

    assert progress["data"]["xp"] == 4200, "the metrics save destroyed the learner's XP"
    assert progress["data"]["streak"] == 17
    assert progress["data"]["lessonLevels"] == PROGRESS_DATA["lessonLevels"]
    assert metrics["data"]["liveSessions"] == 9
    assert metrics["data"]["leagueWins"] == 2


def test_a_later_progress_save_cannot_erase_the_metrics_record(db):
    state_store.save_state_key(UID, "metrics", envelope(METRICS_DATA, "2026-08-26T10:00:00Z"), caller_uid=UID)
    state_store.save_state_key(UID, "progress", envelope(PROGRESS_DATA, "2026-08-26T11:00:00Z"), caller_uid=UID)

    assert state_store.load_state_key(UID, "metrics", caller_uid=UID)["data"] == METRICS_DATA


def test_records_are_separate_documents(db):
    state_store.save_state_key(UID, "progress", envelope(PROGRESS_DATA, "t1"), caller_uid=UID)
    state_store.save_state_key(UID, "metrics", envelope(METRICS_DATA, "t2"), caller_uid=UID)

    assert ROOT in db.store, "the default key must stay at the pre-keying path"
    assert METRICS_DOC in db.store
    assert "liveSessions" not in db.store[ROOT]["data"]


def test_default_key_is_the_parent_document(db):
    """`checkpoints._completed_lessons` reads ohmlet_state/{uid}.data.lessonLevels
    straight out of Firestore. If progress ever stopped living there, the
    checkpoint XP a learner has earned would silently vanish."""
    state_store.save_state_key(UID, "progress", envelope(PROGRESS_DATA, "t1"), caller_uid=UID)

    assert db.store[ROOT]["data"]["lessonLevels"] == PROGRESS_DATA["lessonLevels"]


# ── Migration of documents written before keying ────────────────────────────

def test_legacy_union_document_migrates_metrics_under_the_right_key(db):
    """The shape two web hooks actually produced: both records in one document."""
    db.store[ROOT] = envelope({**PROGRESS_DATA, **METRICS_DATA}, "2026-08-20T09:00:00Z")

    metrics = state_store.load_state_key(UID, "metrics", caller_uid=UID)

    assert metrics["data"] == METRICS_DATA
    assert metrics["updatedAt"] == "2026-08-20T09:00:00Z", "migration must not stamp itself as newer"
    assert metrics["migratedFrom"] == "legacy-unkeyed-document"


def test_migration_leaves_the_progress_half_where_it_was(db):
    db.store[ROOT] = envelope({**PROGRESS_DATA, **METRICS_DATA}, "2026-08-20T09:00:00Z")

    state_store.load_state_key(UID, "metrics", caller_uid=UID)
    progress = state_store.load_state_key(UID, "progress", caller_uid=UID)

    assert progress["data"]["xp"] == 4200
    assert progress["data"]["lessonLevels"] == PROGRESS_DATA["lessonLevels"]


def test_migration_is_not_destructive(db):
    """The carve copies. Stripping the fields would strand a client still
    reading the unkeyed path: it would rehydrate zeroed counters and save
    them back over the good ones."""
    db.store[ROOT] = envelope({**PROGRESS_DATA, **METRICS_DATA}, "2026-08-20T09:00:00Z")

    state_store.load_state_key(UID, "metrics", caller_uid=UID)

    assert db.store[ROOT]["data"]["liveSessions"] == 9


def test_metrics_only_legacy_document_does_not_invent_progress(db):
    """This learner's progress was already destroyed before the fix shipped.
    The server cannot recover it and must not fabricate it."""
    db.store[ROOT] = envelope(dict(METRICS_DATA), "2026-08-20T09:00:00Z")

    metrics = state_store.load_state_key(UID, "metrics", caller_uid=UID)
    progress = state_store.load_state_key(UID, "progress", caller_uid=UID)

    assert metrics["data"] == METRICS_DATA
    assert "xp" not in progress["data"]


def test_migration_never_overwrites_an_existing_record(db):
    db.store[ROOT] = envelope({**PROGRESS_DATA, **METRICS_DATA}, "2026-08-20T09:00:00Z")
    fresh = {**METRICS_DATA, "liveSessions": 40}
    db.store[METRICS_DOC] = envelope(fresh, "2026-08-26T12:00:00Z")

    assert state_store.load_state_key(UID, "metrics", caller_uid=UID)["data"]["liveSessions"] == 40


def test_migration_is_idempotent(db):
    db.store[ROOT] = envelope({**PROGRESS_DATA, **METRICS_DATA}, "2026-08-20T09:00:00Z")

    first = state_store.load_state_key(UID, "metrics", caller_uid=UID)
    second = state_store.load_state_key(UID, "metrics", caller_uid=UID)

    assert first == second


def test_no_legacy_document_migrates_to_nothing(db):
    assert state_store.load_state_key(UID, "metrics", caller_uid=UID) == {}
    assert METRICS_DOC not in db.store, "an absent record must not be materialised"


def test_a_key_with_no_legacy_footprint_is_not_carved_from_progress(db):
    db.store[ROOT] = envelope({**PROGRESS_DATA, **METRICS_DATA}, "2026-08-20T09:00:00Z")

    assert state_store.load_state_key(UID, "sandbox", caller_uid=UID) == {}


# ── Shape identification ────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "data, expected_key, expected_fan_out",
    [
        (PROGRESS_DATA, "progress", False),
        ({**PROGRESS_DATA, "metrics": {"liveSessions": 3}}, "progress", False),  # mobile's nested shape
        (METRICS_DATA, "metrics", False),
        ({"liveSessions": 1}, "metrics", False),
        ({**PROGRESS_DATA, **METRICS_DATA}, "progress", True),
        ({}, "progress", False),
        ({"somethingElse": 1}, "progress", False),
    ],
)
def test_legacy_payload_classification(data, expected_key, expected_fan_out):
    key, fan_out = state_store.classify_legacy_payload(envelope(data, "t"))

    assert key == expected_key
    assert bool(fan_out) is expected_fan_out


def test_a_metrics_only_payload_is_routed_whole(db):
    """Routing moves a record, it does not filter one. A field the server does
    not recognise travels with the payload rather than being dropped."""
    state_store.save_state(UID, envelope({**METRICS_DATA, "unknownField": 7}, "t"), caller_uid=UID)

    assert db.store[METRICS_DOC]["data"]["unknownField"] == 7
    assert ROOT not in db.store, "a metrics write created an empty progress record"


# ── Clients that predate keying ─────────────────────────────────────────────

def test_installed_mobile_build_still_writes_the_progress_record(db):
    """The build already on people's phones PUTs its Progress shape to the
    unkeyed path and will keep doing so until they update."""
    state_store.save_state_key(UID, "metrics", envelope(METRICS_DATA, "2026-08-26T10:00:00Z"), caller_uid=UID)
    legacy = {**PROGRESS_DATA, "metrics": {"liveSessions": 1, "drawings": 0}}

    result = state_store.save_state(UID, envelope(legacy, "2026-08-26T11:00:00Z"), caller_uid=UID)

    assert result["key"] == "progress"
    assert db.store[ROOT]["data"]["xp"] == 4200
    assert db.store[METRICS_DOC]["data"] == METRICS_DATA, "the phone erased the web's counters"


def test_old_client_flat_put_cannot_destroy_a_migrated_record(db):
    """A browser tab left open across the deploy still PUTs the unkeyed path
    with a metrics-only envelope. It must land in the metrics record."""
    state_store.save_state_key(UID, "progress", envelope(PROGRESS_DATA, "2026-08-26T10:00:00Z"), caller_uid=UID)
    stale_tab = {**METRICS_DATA, "liveSessions": 12}

    result = state_store.save_state(UID, envelope(stale_tab, "2026-08-26T12:00:00Z"), caller_uid=UID)

    assert result["key"] == "metrics"
    assert db.store[ROOT]["data"]["xp"] == 4200, "an old client destroyed the learner's XP"
    assert db.store[ROOT]["data"]["streak"] == 17
    assert db.store[METRICS_DOC]["data"]["liveSessions"] == 12


def test_old_client_union_write_keeps_progress_and_mirrors_metrics(db):
    union = {**PROGRESS_DATA, **METRICS_DATA}

    result = state_store.save_state(UID, envelope(union, "2026-08-26T12:00:00Z"), caller_uid=UID)

    assert result["key"] == "progress"
    assert db.store[ROOT]["data"]["xp"] == 4200
    assert db.store[METRICS_DOC]["data"] == METRICS_DATA


def test_legacy_read_serves_every_record_merged(db):
    state_store.save_state_key(UID, "progress", envelope(PROGRESS_DATA, "2026-08-26T10:00:00Z"), caller_uid=UID)
    state_store.save_state_key(UID, "metrics", envelope(METRICS_DATA, "2026-08-26T10:00:05Z"), caller_uid=UID)

    view = state_store.load_state(UID, caller_uid=UID)

    assert view["data"]["xp"] == 4200
    assert view["data"]["liveSessions"] == 9
    assert view["updatedAt"] == "2026-08-26T10:00:05Z"


def test_legacy_read_prefers_the_keyed_record_over_stale_residue(db):
    db.store[ROOT] = envelope({**PROGRESS_DATA, **METRICS_DATA}, "2026-08-20T09:00:00Z")
    db.store[METRICS_DOC] = envelope({**METRICS_DATA, "liveSessions": 40}, "2026-08-26T09:00:00Z")

    view = state_store.load_state(UID, caller_uid=UID)

    assert view["data"]["liveSessions"] == 40


def test_legacy_read_of_an_unknown_user_is_empty(db):
    assert state_store.load_state(UID, caller_uid=UID) == {}


def test_legacy_read_survives_a_non_object_payload(db):
    """`validate_state_envelope` allows `data` to be a list. There is no
    field-wise merge for that, so the record is returned as stored."""
    db.store[ROOT] = {"version": 1, "data": [1, 2, 3], "updatedAt": "t"}

    assert state_store.load_state(UID, caller_uid=UID)["data"] == [1, 2, 3]


# ── Concurrency, keys, authorisation ────────────────────────────────────────

def test_a_stale_save_is_still_rejected_per_key(db):
    state_store.save_state_key(UID, "metrics", envelope(METRICS_DATA, "2026-08-26T12:00:00Z"), caller_uid=UID)

    result = state_store.save_state_key(
        UID, "metrics", envelope({**METRICS_DATA, "liveSessions": 0}, "2026-08-26T09:00:00Z"), caller_uid=UID
    )

    assert result["status"] == "stale"
    assert db.store[METRICS_DOC]["data"]["liveSessions"] == 9


def test_an_empty_key_means_the_default_record():
    assert state_store.normalize_key("") == "progress"
    assert state_store.normalize_key(None) == "progress"


@pytest.mark.parametrize("bad", ["../plans", "a/b", ".", "9lives", "meT rics", "x" * 41])
def test_malformed_keys_are_refused(bad):
    with pytest.raises(HTTPException) as exc:
        state_store.normalize_key(bad)
    assert exc.value.status_code == 400


def test_keys_are_case_folded(db):
    """Two spellings must not become two records. Folding is safer than
    rejecting: a client that sends 'Metrics' reaches its own data."""
    state_store.save_state_key(UID, "Metrics", envelope(METRICS_DATA, "t"), caller_uid=UID)

    assert METRICS_DOC in db.store
    assert state_store.load_state_key(UID, "metrics", caller_uid=UID)["data"] == METRICS_DATA


def test_key_ceiling_stops_unbounded_documents(db, monkeypatch):
    monkeypatch.setattr(state_store, "MAX_STATE_KEYS", 2)
    for name in ("metrics", "sandbox"):
        state_store.save_state_key(UID, name, envelope({"a": 1}, "t"), caller_uid=UID)

    with pytest.raises(HTTPException) as exc:
        state_store.save_state_key(UID, "junk", envelope({"a": 1}, "t"), caller_uid=UID)
    assert exc.value.status_code == 429

    # An existing key keeps saving; the ceiling is on new documents.
    assert state_store.save_state_key(UID, "metrics", envelope({"a": 2}, "u"), caller_uid=UID)["status"] == "ok"


def test_a_keyed_route_refuses_another_users_record(db):
    for call in (
        lambda: state_store.load_state_key("someone-else", "metrics", caller_uid=UID),
        lambda: state_store.save_state_key("someone-else", "metrics", envelope({}, "t"), caller_uid=UID),
    ):
        with pytest.raises(HTTPException) as exc:
            call()
        assert exc.value.status_code == 403


def test_oversized_records_are_still_refused(db):
    huge = envelope({"blob": "x" * (validation.MAX_STATE_BYTES + 1)}, "t")
    with pytest.raises(HTTPException) as exc:
        state_store.save_state_key(UID, "metrics", huge, caller_uid=UID)
    assert exc.value.status_code == 413


# ── Privacy: keyed records are exported and erased ──────────────────────────

def test_keyed_records_are_included_in_the_data_export(db):
    db.store[ROOT] = envelope(PROGRESS_DATA, "t")
    db.store[METRICS_DOC] = envelope(METRICS_DATA, "t")

    exported = privacy._export_state_keys(db, UID)

    assert exported["metrics"]["data"] == METRICS_DATA


def test_keyed_records_are_erased_with_the_account(db):
    db.store[ROOT] = envelope(PROGRESS_DATA, "t")
    db.store[METRICS_DOC] = envelope(METRICS_DATA, "t")
    db.store["ohmlet_state/other/keys/metrics"] = envelope(METRICS_DATA, "t")

    removed = privacy._purge_state_keys(db, UID)

    assert removed == 1
    assert METRICS_DOC not in db.store, "a keyed record survived account deletion"
    assert "ohmlet_state/other/keys/metrics" in db.store, "erasure reached another user"


# ── The carve must not depend on which surface the learner opens first ───────

def test_a_progress_save_cannot_strand_an_unmigrated_metrics_record(db):
    """The order the client happens to touch the two records in must not decide
    whether the counters survive.

    The default key IS the pre-keying document, so saving `progress` replaces
    whatever that document held. A learner whose legacy record was metrics-only
    (the achievements page saved last, which is the original bug) is served that
    document as their progress record. If the workspace then persists a progress
    shape before anything has asked for `metrics`, the only copy of the counters
    is overwritten and the later migration finds nothing to carve.
    """
    db.store[ROOT] = envelope(dict(METRICS_DATA), "2026-08-20T09:00:00Z")

    state_store.load_state_key(UID, "progress", caller_uid=UID)
    state_store.save_state_key(UID, "progress", envelope(PROGRESS_DATA, "2026-08-26T10:00:00Z"), caller_uid=UID)

    metrics = state_store.load_state_key(UID, "metrics", caller_uid=UID)

    assert metrics["data"] == METRICS_DATA, "a progress save destroyed the counters"
    assert db.store[ROOT]["data"]["xp"] == 4200


def test_a_legacy_flat_put_also_carves_before_replacing_the_document(db):
    """Same invariant on the compatibility route: an installed client PUTting
    its progress shape to the unkeyed path replaces the same document."""
    db.store[ROOT] = envelope(dict(METRICS_DATA), "2026-08-20T09:00:00Z")

    state_store.save_state(UID, envelope(PROGRESS_DATA, "2026-08-26T10:00:00Z"), caller_uid=UID)

    assert state_store.load_state_key(UID, "metrics", caller_uid=UID)["data"] == METRICS_DATA


def test_carving_is_still_a_no_op_once_the_record_exists(db):
    """The write-path carve must never reach back over a live record with the
    legacy copy."""
    db.store[ROOT] = envelope({**PROGRESS_DATA, **METRICS_DATA}, "2026-08-20T09:00:00Z")
    db.store[METRICS_DOC] = envelope({**METRICS_DATA, "liveSessions": 40}, "2026-08-26T09:00:00Z")

    state_store.save_state_key(UID, "progress", envelope(PROGRESS_DATA, "2026-08-26T10:00:00Z"), caller_uid=UID)

    assert db.store[METRICS_DOC]["data"]["liveSessions"] == 40


# ── The shape the installed mobile build actually wrote ─────────────────────

def test_counters_nested_by_the_installed_mobile_build_still_migrate(db):
    """That build PUTs its counters as `data.metrics`, not at the top level. A
    top-level-only carve found nothing, so a learner who had only ever used
    their phone opened the web achievements page to zeroes for counters the
    server was holding one level down."""
    db.store[ROOT] = envelope({**PROGRESS_DATA, "metrics": dict(METRICS_DATA)}, "2026-08-20T09:00:00Z")

    metrics = state_store.load_state_key(UID, "metrics", caller_uid=UID)

    assert metrics["data"] == METRICS_DATA
    assert metrics["updatedAt"] == "2026-08-20T09:00:00Z"


def test_the_top_level_copy_wins_over_the_nested_one(db):
    """A learner who used both surfaces has both copies. The top-level one is
    the web's, which is the record `metrics` is being carved for; the nested one
    is the phone's and stays where the phone reads it."""
    both = {**PROGRESS_DATA, **METRICS_DATA, "metrics": {**METRICS_DATA, "liveSessions": 1}}
    db.store[ROOT] = envelope(both, "2026-08-20T09:00:00Z")

    assert state_store.load_state_key(UID, "metrics", caller_uid=UID)["data"]["liveSessions"] == 9
    assert db.store[ROOT]["data"]["metrics"]["liveSessions"] == 1, "the phone's copy was disturbed"


def test_a_nested_object_that_is_not_a_record_carves_nothing(db):
    db.store[ROOT] = envelope({**PROGRESS_DATA, "metrics": "not-an-object"}, "t")

    assert state_store.load_state_key(UID, "metrics", caller_uid=UID) == {}


# ── The compatibility read must not drop what it does not understand ────────

def test_legacy_read_keeps_top_level_fields_it_does_not_own(db):
    """`GET /v1/state/{uid}` used to return the stored document verbatim. A
    record whose top level is not exactly {version, data, updatedAt} must not
    come back with the rest silently removed: the pre-keying client reading this
    path would hydrate the gap and save it back."""
    db.store[ROOT] = {**envelope(PROGRESS_DATA, "t"), "deviceId": "phone-7"}

    view = state_store.load_state(UID, caller_uid=UID)

    assert view["deviceId"] == "phone-7"
    assert view["data"]["xp"] == 4200
