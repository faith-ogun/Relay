"""Account erasure must actually reach everything it claims to.

The privacy policy says "when you delete your account, we delete or anonymise
your personal data, except where we must keep some records by law". Before this,
erasure covered the plan, learning state, Stripe customer, live budget and usage
records only, so a deleted account left its community posts, comments,
reactions, challenge memberships, league standings, blocks, consent record,
interview reports and 3D twins behind, each still tagged with the uid.

These tests assert the collection map is complete and that the two deliberate
retentions stay deliberate.
"""

from __future__ import annotations

import pytest

import privacy


class FakeSnapshot:
    def __init__(self, doc_id, data, ref):
        self.id = doc_id
        self._data = data
        self.reference = ref
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class FakeRef:
    def __init__(self, store, key):
        self._store = store
        self._key = key

    def delete(self):
        self._store.pop(self._key, None)

    def set(self, data):
        self._store[self._key] = dict(data)

    def get(self):
        return FakeSnapshot(self._key.split("/")[-1], self._store.get(self._key), self)


class FakeQuery:
    def __init__(self, store, name, field, value):
        self._store, self._name, self._field, self._value = store, name, field, value

    def stream(self):
        for key, data in list(self._store.items()):
            if key.startswith(f"{self._name}/") and data.get(self._field) == self._value:
                yield FakeSnapshot(key.split("/")[-1], data, FakeRef(self._store, key))


class FakeCollection:
    _counter = 0

    def __init__(self, store, name):
        self._store, self._name = store, name

    def where(self, *, filter):
        return FakeQuery(self._store, self._name, filter.field_path, filter.value)

    def document(self, doc_id=None):
        if doc_id is None:
            FakeCollection._counter += 1
            doc_id = f"generated{FakeCollection._counter}"
        return FakeRef(self._store, f"{self._name}/{doc_id}")


class FakeClient:
    def __init__(self):
        self.store: dict[str, dict] = {}

    def collection(self, name):
        return FakeCollection(self.store, name)


@pytest.fixture
def client():
    return FakeClient()


# ── The collection map ──────────────────────────────────────────────────────

def test_every_community_collection_is_covered():
    """A new collection holding a uid must be added to the erasure map."""
    covered = {c for c, _ in privacy._UID_FIELD_COLLECTIONS}
    for expected in (
        "community_posts", "community_comments", "community_reactions",
        "community_challenge_members", "community_leaderboard", "community_blocks",
        "ohmlet_interviews", "ohmlet_twins", "ohmlet_twin_shares",
    ):
        assert expected in covered, f"{expected} survives account deletion"


def test_moderation_reports_are_not_in_the_delete_map():
    """Reports are retained as a DSA audit trail and anonymised instead."""
    covered = {c for c, _ in privacy._UID_FIELD_COLLECTIONS}
    assert privacy._REPORTS_COLLECTION not in covered


# ── Purging ─────────────────────────────────────────────────────────────────

def test_purge_removes_only_the_target_users_rows(client):
    client.store["community_posts/a"] = {"uid": "victim", "title": "mine"}
    client.store["community_posts/b"] = {"uid": "bystander", "title": "theirs"}

    removed = privacy._purge_by_field(client, "community_posts", "uid", "victim")

    assert removed == 1
    assert "community_posts/a" not in client.store
    assert "community_posts/b" in client.store, "erasure deleted another user's post"


def test_blocks_against_the_deleted_user_are_removed(client):
    client.store["community_blocks/other__victim"] = {"uid": "other", "targetUid": "victim"}
    client.store["community_blocks/other__someone"] = {"uid": "other", "targetUid": "someone"}

    assert privacy._purge_blocks_targeting(client, "victim") == 1
    assert "community_blocks/other__someone" in client.store


def test_purge_is_resilient_to_one_collection_failing(client, monkeypatch):
    """A single failure must not abandon the rest of the erasure."""
    class Boom(FakeClient):
        def collection(self, name):
            raise RuntimeError("firestore unavailable")

    assert privacy._purge_by_field(Boom(), "community_posts", "uid", "victim") == 0


# ── Anonymisation ───────────────────────────────────────────────────────────

def test_reports_survive_deletion_without_the_reporter_identity(client):
    client.store["community_reports/p1__victim"] = {
        "postId": "p1", "reporterUid": "victim", "createdAt": "2026-01-01",
    }

    changed = privacy._anonymise_reports(client, "victim")

    assert changed == 1
    rows = [v for k, v in client.store.items() if k.startswith("community_reports/")]
    assert len(rows) == 1, "the moderation audit trail was destroyed"
    assert rows[0]["reporterUid"] == "deleted-account"
    assert rows[0]["postId"] == "p1", "the report content was lost"
    assert "reporterErasedAt" in rows[0]
    assert not any("victim" in k for k in client.store), "the uid survived in the document id"
