"""The abuse ceiling: bounds how MUCH, where the rate limiter bounds how FAST.

Worth a file because the failure it prevents is invisible until it is expensive.
`ratelimit.enforce_rest` caps an identity at 120 requests a minute, which reads
as protective and is not: 120/min is 172,800 paid Gemini calls a day from one
signed-in account, every one of them inside the limit.

Four promises, in the order they matter:

  1. Under the cap, requests pass and the count rises.
  2. At the cap, the next request is refused with 429.
  3. **Failing OPEN.** If Firestore is unreachable the request proceeds. This
     inverts how entitlements fail on purpose: an entitlement failing open gives
     away something paid for, while an abuse ceiling failing closed blocks every
     honest learner during an outage to stop an attacker we may not have. The
     asymmetry is the whole design and it deserves a test that pins it.
  4. Counters are per (uid, action, month), so one learner's compiles cannot
     exhaust another's, and a new month starts clean without a cleanup job.

Point 3 is the one worth the file. It is the kind of decision a later reader
would "fix" into failing closed, and this test says why not.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

import quota


# ── A Firestore stand-in with a real transaction boundary ───────────────────

class FakeSnapshot:
    def __init__(self, data):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class FakeDoc:
    def __init__(self, store, key, failing):
        self._store, self._key, self._failing = store, key, failing

    def get(self, transaction=None):
        if self._failing:
            raise RuntimeError("Firestore unavailable")
        return FakeSnapshot(self._store.get(self._key))

    def set(self, data, merge=False):
        self._store[self._key] = dict(data)


class FakeCollection:
    def __init__(self, store, failing):
        self._store, self._failing = store, failing

    def document(self, doc_id):
        return FakeDoc(self._store, doc_id, self._failing)


class FakeTransaction:
    def __init__(self):
        self._writes = []

    def set(self, ref, data, merge=False):
        self._writes.append(lambda: ref.set(data, merge=merge))

    def commit(self):
        for w in self._writes:
            w()
        self._writes.clear()


class FakeClient:
    def __init__(self, store, failing=False):
        self.store, self.failing = store, failing

    def collection(self, name):
        return FakeCollection(self.store, self.failing)

    def transaction(self):
        return FakeTransaction()


@pytest.fixture
def store(monkeypatch):
    data: dict[str, dict] = {}

    class FakeFirestore:
        Client = staticmethod(lambda *a, **k: FakeClient(data))
        Transaction = FakeTransaction

        @staticmethod
        def transactional(fn):
            def wrapper(transaction, *args, **kwargs):
                result = fn(transaction, *args, **kwargs)
                transaction.commit()
                return result
            return wrapper

    import types
    fake_module = types.ModuleType("google.cloud.firestore")
    fake_module.Client = FakeFirestore.Client
    fake_module.transactional = FakeFirestore.transactional
    fake_module.Transaction = FakeTransaction
    monkeypatch.setitem(sys.modules, "google.cloud.firestore", fake_module)
    return data


# ── The promises ────────────────────────────────────────────────────────────

def test_counts_up_under_the_cap(store):
    assert quota.enforce("u1", "compile", limit=3) == 1
    assert quota.enforce("u1", "compile", limit=3) == 2
    assert quota.enforce("u1", "compile", limit=3) == 3


def test_refuses_at_the_cap(store):
    for _ in range(2):
        quota.enforce("u1", "compile", limit=2)
    with pytest.raises(HTTPException) as e:
        quota.enforce("u1", "compile", limit=2)
    assert e.value.status_code == 429


def test_one_learner_cannot_exhaust_another(store):
    quota.enforce("u1", "compile", limit=1)
    # u1 is spent; u2 must be untouched.
    with pytest.raises(HTTPException):
        quota.enforce("u1", "compile", limit=1)
    assert quota.enforce("u2", "compile", limit=1) == 1


def test_actions_are_counted_separately(store):
    quota.enforce("u1", "compile", limit=1)
    with pytest.raises(HTTPException):
        quota.enforce("u1", "compile", limit=1)
    # A spent compile budget must not close the kit check.
    assert quota.enforce("u1", "vision", limit=1) == 1


def test_fails_OPEN_when_firestore_is_down(monkeypatch):
    """The one that matters. An outage must not lock out honest learners.

    If this ever starts failing because someone made the ceiling fail closed,
    read the module docstring before changing the test: the asymmetry is
    deliberate. Being unable to count is not evidence of abuse.
    """
    import types
    fake_module = types.ModuleType("google.cloud.firestore")
    fake_module.Client = lambda *a, **k: FakeClient({}, failing=True)
    fake_module.transactional = lambda fn: fn
    monkeypatch.setitem(sys.modules, "google.cloud.firestore", fake_module)

    # No exception, request proceeds.
    assert quota.enforce("u1", "compile", limit=1) == 0


def test_a_zero_limit_disables_the_ceiling(store):
    for _ in range(50):
        assert quota.enforce("u1", "unknown-action", limit=0) == 0


def test_default_limits_are_generous_enough_to_be_invisible():
    """These are abuse ceilings, not paywalls. If someone tunes one down to a
    number a real learner could reach in a month, this fails and asks why."""
    assert quota.DEFAULT_LIMITS["vision"] >= 100, "a kit check per build, plus retries"
    assert quota.DEFAULT_LIMITS["quiz"] >= 1000, "several per lesson, 284 lessons"
    assert quota.DEFAULT_LIMITS["compile"] >= 200, "iterating on a sketch is the point"
