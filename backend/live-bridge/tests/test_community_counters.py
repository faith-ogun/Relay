"""Behaviour of the community counters, against an in-memory Firestore.

These handlers used to read a counter outside any transaction and write back a
value derived from it. They now decide inside one.

What these tests cover: the moderation threshold actually hides a post, a
repeat report counts once, and likes received are summed across the author's own
posts including hidden ones. None of that had any coverage before, because the
community tests were all pure functions and never touched a handler.

Challenge participation moved to test_challenge_lifecycle.py when challenges
gained instances: a join is now counted on the instance, not on the series, so
the counter tests belong beside the rollover they have to survive.

What they do NOT cover: the concurrency guarantee itself. Interleaved commits
are Firestore's job (it retries a transaction whose reads were invalidated), and
a single-threaded stand-in cannot prove that. These tests pin the logic that
sits on top of it, so a regression to a post-write read shows up as a threshold
or idempotency failure here.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

import community


# ── Minimal Firestore stand-in ──────────────────────────────────────────────

class FakeSnapshot:
    def __init__(self, data):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class FakeDoc:
    def __init__(self, store, key):
        self._store = store
        self._key = key
        self.id = key.split("/")[-1]

    def get(self, transaction=None):
        return FakeSnapshot(self._store.get(self._key))

    def set(self, data, merge=False):
        if merge and self._key in self._store:
            self._store[self._key].update(data)
        else:
            self._store[self._key] = dict(data)

    def update(self, data):
        self._store.setdefault(self._key, {}).update(data)

    def delete(self):
        self._store.pop(self._key, None)


class FakeCollection:
    def __init__(self, store, name):
        self._store = store
        self._name = name

    def document(self, doc_id=None):
        return FakeDoc(self._store, f"{self._name}/{doc_id}")


class FakeTransaction:
    """Writes are buffered and applied on commit, as a real transaction does."""

    def __init__(self):
        self._writes = []

    def set(self, ref, data):
        self._writes.append(lambda: ref.set(data))

    def update(self, ref, data):
        self._writes.append(lambda: ref.update(data))

    def delete(self, ref):
        self._writes.append(lambda: ref.delete())

    def commit(self):
        for w in self._writes:
            w()
        self._writes.clear()


class FakeClient:
    def __init__(self):
        self.store: dict[str, dict] = {}

    def collection(self, name):
        return FakeCollection(self.store, name)

    def transaction(self):
        return FakeTransaction()


@pytest.fixture
def fake(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(community, "_client", lambda: client)

    # The real decorator drives a live Transaction object. Here the function is
    # run directly and its buffered writes committed, which is the same
    # read-then-write ordering without a server.
    def passthrough(fn):
        def wrapper(transaction, *args, **kwargs):
            result = fn(transaction, *args, **kwargs)
            transaction.commit()
            return result
        return wrapper

    monkeypatch.setattr(community.firestore, "transactional", passthrough)
    return client


def _post(client, post_id="p1", **fields):
    client.store[f"{community.POSTS}/{post_id}"] = {"id": post_id, "uid": "author", "reports": 0, **fields}


# ── Reporting and auto-hide ─────────────────────────────────────────────────

def test_report_hides_post_once_threshold_is_reached(fake):
    _post(fake)
    for i in range(community.REPORT_HIDE_THRESHOLD):
        result = community.report_post("p1", claims={"uid": f"reporter{i}"})
        assert result["status"] == "reported"

    post = fake.store[f"{community.POSTS}/p1"]
    assert post["reports"] == community.REPORT_HIDE_THRESHOLD
    assert post["hidden"] is True, "post passed the reporting threshold and stayed visible"


def test_report_does_not_hide_below_threshold(fake):
    _post(fake)
    for i in range(community.REPORT_HIDE_THRESHOLD - 1):
        community.report_post("p1", claims={"uid": f"reporter{i}"})
    assert fake.store[f"{community.POSTS}/p1"].get("hidden") is not True


def test_reporting_twice_counts_once(fake):
    _post(fake)
    assert community.report_post("p1", claims={"uid": "u1"})["status"] == "reported"
    assert community.report_post("p1", claims={"uid": "u1"})["status"] == "already_reported"
    assert fake.store[f"{community.POSTS}/p1"]["reports"] == 1


def test_report_on_missing_post_is_404(fake):
    with pytest.raises(HTTPException) as exc:
        community.report_post("nope", claims={"uid": "u1"})
    assert exc.value.status_code == 404


# ── Likes received ──────────────────────────────────────────────────────────

def test_stats_sums_likes_across_the_callers_own_posts(fake, monkeypatch):
    fake.store[f"{community.POSTS}/a"] = {"uid": "me", "likes": 3}
    fake.store[f"{community.POSTS}/b"] = {"uid": "me", "likes": 4, "hidden": True}
    fake.store[f"{community.POSTS}/c"] = {"uid": "someone-else", "likes": 99}

    def fake_where(*, filter):
        class Q:
            def stream(self_inner):
                target = filter.value
                collection = filter._collection
                return [
                    FakeSnapshot(v)
                    for k, v in fake.store.items()
                    if k.startswith(f"{collection}/") and v.get("uid") == target
                ]
        return Q()

    def collection(name):
        col = FakeCollection(fake.store, name)
        col.where = lambda *, filter: _bind(fake_where, filter, name)
        return col

    def _bind(fn, filt, name):
        filt._collection = name
        return fn(filter=filt)

    monkeypatch.setattr(fake, "collection", collection)

    stats = community.community_stats(claims={"uid": "me"})
    assert stats["likesReceived"] == 7, "a hidden post's earned likes were dropped"
    assert stats["posts"] == 2
