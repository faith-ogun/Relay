"""Career coaching, and the evidence it is allowed to stand on.

The research was blunt about the strategy: Snubber already sells company-specific
hardware interview prep for twenty-plus named firms at $35 a month, so Ohmlet
cannot win that lane. What no incumbent can reach is VERIFIED BUILD EVIDENCE.
Every hardware CV claims bench experience and every interviewer discounts it,
because there is no way to check. Ohmlet watched it happen.

That only works if the evidence is honest, so these tests are mostly about
refusing to overclaim:

  1. A short session is not bench experience. The only sessions on record today
     are nine test connections averaging a minute; counting those would make the
     record a lie on day one.
  2. Camera minutes are counted SEPARATELY from bench minutes. `image_frames > 0`
     is the hardest thing here to fake and the most valuable thing to be able to
     say, and merging it into a single total would throw that away.
  3. An empty record says so. It does not round up, and it does not hide.
  4. Every source is a server-owned record, so nothing here can be inflated from
     a client.
  5. A missing collection degrades to zero rather than failing the request. A
     coaching session that cannot start because Firestore hiccuped is worse than
     one that starts with a thinner record.

Point 1 is the one that keeps the feature honest. Everything else follows from
being willing to report a small number.
"""

from __future__ import annotations

import pytest

import career


# ── A Firestore stand-in ────────────────────────────────────────────────────

class FakeSnapshot:
    def __init__(self, data, doc_id="x"):
        self._data = data
        self.exists = data is not None
        self.id = doc_id

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def where(self, filter=None):
        return self

    def stream(self):
        return [FakeSnapshot(r) for r in self._rows]


class FakeDoc:
    def __init__(self, data):
        self._data = data

    def get(self, transaction=None):
        return FakeSnapshot(self._data)


class FakeCollection:
    def __init__(self, rows, doc_data=None):
        self._rows = rows
        self._doc = doc_data

    def where(self, filter=None):
        return FakeQuery(self._rows)

    def stream(self):
        return FakeQuery(self._rows).stream()

    def document(self, doc_id=None):
        return FakeDoc(self._doc)


class FakeClient:
    def __init__(self, sessions=(), state=None, twins=()):
        self._by_name = {
            career.USAGE_COLLECTION: FakeCollection(list(sessions)),
            career.STATE_COLLECTION: FakeCollection([], doc_data=state),
            career.TWINS_COLLECTION: FakeCollection(list(twins)),
        }

    def collection(self, name):
        return self._by_name.get(name, FakeCollection([]))


@pytest.fixture
def patched(monkeypatch):
    def use(client):
        import state_store
        monkeypatch.setattr(state_store, "get_client", lambda: client)
        return client
    return use


def session(seconds: float, frames: int = 0) -> dict:
    return {"user_id": "u1", "duration_seconds": seconds, "image_frames": frames}


# ── Refusing to overclaim ───────────────────────────────────────────────────

def test_a_short_session_is_not_bench_experience(patched):
    """The only sessions on record are nine test connections averaging a minute.
    Counting those as bench work would make the record a lie on day one."""
    patched(FakeClient(sessions=[session(30), session(60), session(90)]))
    ev = career.evidence("u1")
    assert ev["bench"]["sessions"] == 0
    assert ev["bench"]["minutes"] == 0


def test_a_real_session_counts(patched):
    patched(FakeClient(sessions=[session(600, frames=200)]))
    b = career.evidence("u1")["bench"]
    assert b["sessions"] == 1
    assert b["minutes"] == 10


def test_camera_minutes_are_counted_separately(patched):
    """`image_frames > 0` means a phone was pointed at a real bench. It is the
    hardest thing here to fake and the most valuable to be able to claim, so it
    must not be merged into one total."""
    patched(FakeClient(sessions=[session(600, frames=200), session(600, frames=0)]))
    b = career.evidence("u1")["bench"]
    assert b["sessions"] == 2 and b["minutes"] == 20
    assert b["cameraSessions"] == 1 and b["cameraMinutes"] == 10


def test_an_empty_record_says_so_rather_than_rounding_up(patched):
    patched(FakeClient())
    ev = career.evidence("u1")
    line = career.summary_line(ev)
    assert "No verified bench work yet" in line
    # And it frames it as the next action rather than as a failure.
    assert "first thing to change" in line


def test_the_summary_never_claims_more_than_the_record(patched):
    patched(FakeClient(sessions=[session(600, frames=100)]))
    ev = career.evidence("u1")
    line = career.summary_line(ev)
    assert "10 minutes" in line
    # No adjectives. "Solid hands-on experience" is exactly what a coach must
    # not say about ten minutes.
    for word in ("solid", "extensive", "significant", "strong", "experienced"):
        assert word not in line.lower(), word


def test_the_caveat_travels_with_the_evidence(patched):
    """Anyone reading this record, coach or CV, must see its limits with it."""
    patched(FakeClient(sessions=[session(600, frames=100)]))
    ev = career.evidence("u1")
    assert "not a complete history" in ev["caveat"]


# ── Assessed competence, which is the other half ────────────────────────────

def test_gold_is_distinguished_from_completed(patched):
    """Seen and drilled are different claims and must not collapse."""
    patched(FakeClient(state={"data": {"lessonLevels": {"a": 1, "b": 3, "c": 3}}}))
    lg = career.evidence("u1")["learning"]
    assert lg["completed"] == 3
    assert lg["gold"] == 2


def test_ready_twins_only(patched):
    patched(FakeClient(twins=[{"status": "ready"}, {"status": "failed"}, {"status": "pending"}]))
    assert career.evidence("u1")["artifacts"]["twins"] == 1


# ── Degrading rather than failing ───────────────────────────────────────────

def test_every_collection_failing_still_returns_a_record(monkeypatch):
    """A coaching session that cannot start because Firestore hiccuped is worse
    than one that starts with a thin record. Every source absorbs its own
    failure, so a total outage yields an empty record and an honest summary
    rather than a 500.

    I originally wrote this expecting a raise. The code was already better than
    my assumption; the test now pins the behaviour that exists."""
    class Exploding:
        def collection(self, name):
            raise RuntimeError("Firestore unavailable")

    import state_store
    monkeypatch.setattr(state_store, "get_client", lambda: Exploding())

    ev = career.evidence("u1")
    assert ev["bench"]["minutes"] == 0
    assert ev["artifacts"]["twins"] == 0
    assert ev["learning"]["completed"] == 0
    # And it says so, rather than presenting an outage as a beginner.
    assert "No verified bench work yet" in career.summary_line(ev)


def test_one_unreadable_collection_does_not_lose_the_others(patched):
    class PartlyBroken(FakeClient):
        def collection(self, name):
            if name == career.TWINS_COLLECTION:
                raise RuntimeError("nope")
            return super().collection(name)

    patched(PartlyBroken(sessions=[session(600, frames=10)]))
    ev = career.evidence("u1")
    assert ev["bench"]["minutes"] == 10   # kept
    assert ev["artifacts"]["twins"] == 0  # lost, reported as zero


# ── The coach's own guardrails ──────────────────────────────────────────────

def test_the_coach_is_told_not_to_inflate_and_not_to_quote_salaries():
    from ohmlet_live_agent.coach_agent import COACH_INSTRUCTION, instruction_with

    assert "NEVER inflate it" in COACH_INSTRUCTION
    # A made-up salary is worse than none: they negotiate against it.
    # Wrapped across a line in the instruction, so match the halves.
    assert "must NOT quote specific salary" in COACH_INSTRUCTION
    assert "a made-up number is worse than" in COACH_INSTRUCTION
    assert "You are NOT an interviewer" in COACH_INSTRUCTION

    bound = instruction_with("Verified on Ohmlet: 10 minutes.", '{"bench": {}}')
    assert "[CAREER CONTEXT]" in bound
    assert "10 minutes" in bound
