"""Ohmlet Labs: the Max promise that had nothing behind it.

The pricing page has sold "early access to Ohmlet Labs" for a while and no such
thing existed. The tempting fix was to delete the line; the right one was to
build it, and this is what "it" has to mean for the promise to be honest.

What these pin:

  1. Max sees a feature at stage `max`; nobody else does. That IS the tier.
  2. A graduated feature (`all`) is everyone's, including Free. Labs is a
     staging area, not a permanent second paywall.
  3. `off` is nobody's, on any plan, including Max. Built is not shipped.
  4. Free and Pro still get a populated screen, listing what is coming. An empty
     screen reads as a bug, and telling someone what they are missing is the
     whole point of an upsell surface.
  5. The stage is server-side and env-overridable, so a misbehaving feature can
     be pulled back without a deploy, and a typo falls back to `off` rather than
     accidentally shipping something broken to everyone.

Point 3 is the one worth the file. `off` must beat plan: a Max subscriber is
paying for early access, not for a switch that ignores whether the feature is
ready.
"""

from __future__ import annotations

import labs


def _stage(monkeypatch, value: str) -> None:
    monkeypatch.setenv("OHMLET_LAB_LESSON_FILMS", value)


# ── Who sees what ───────────────────────────────────────────────────────────

def test_max_gets_early_access(monkeypatch):
    _stage(monkeypatch, "max")
    assert labs.is_on("lesson-films", "max") is True
    ids = [e["id"] for e in labs.available_to("max")]
    assert "lesson-films" in ids


def test_free_and_pro_do_not(monkeypatch):
    _stage(monkeypatch, "max")
    for plan in ("free", "pro"):
        assert labs.is_on("lesson-films", plan) is False, plan
        assert labs.available_to(plan) == [], plan


def test_a_graduated_feature_belongs_to_everyone(monkeypatch):
    """Labs is a staging area on the way OUT, not a second paywall. If this ever
    fails, something has been parked at `max` and quietly become a Max feature."""
    _stage(monkeypatch, "all")
    for plan in ("free", "pro", "max"):
        assert labs.is_on("lesson-films", plan) is True, plan


def test_off_beats_every_plan_including_max(monkeypatch):
    """Built is not shipped. Max buys early access to what is ready, not a switch
    that ignores whether it is."""
    _stage(monkeypatch, "off")
    for plan in ("free", "pro", "max"):
        assert labs.is_on("lesson-films", plan) is False, plan
    assert labs.available_to("max") == []


# ── The screen ──────────────────────────────────────────────────────────────

def test_free_still_sees_what_is_coming(monkeypatch):
    """A learner without early access must not get an empty screen: that reads
    as broken, and the list is what makes the upgrade legible."""
    _stage(monkeypatch, "max")
    st = labs.status("free")
    assert st["labs"] == []
    assert st["hasEarlyAccess"] is False
    assert [e["id"] for e in st["comingToEveryone"]] == ["lesson-films"]
    # Enough to understand it, without pretending they can use it.
    assert st["comingToEveryone"][0]["title"]
    assert st["comingToEveryone"][0]["blurb"]


def test_max_sees_it_as_available_not_as_coming(monkeypatch):
    _stage(monkeypatch, "max")
    st = labs.status("max")
    assert [e["id"] for e in st["labs"]] == ["lesson-films"]
    assert st["comingToEveryone"] == []
    assert st["hasEarlyAccess"] is True
    assert st["labs"][0]["earlyAccess"] is True


def test_a_graduated_feature_is_not_flagged_as_early_access(monkeypatch):
    _stage(monkeypatch, "all")
    entry = labs.status("max")["labs"][0]
    assert entry["earlyAccess"] is False


# ── Safety of the switch itself ─────────────────────────────────────────────

def test_an_unknown_stage_falls_back_to_off(monkeypatch):
    """Fail towards not shipping something unfinished to everybody."""
    _stage(monkeypatch, "everyone-please")
    assert labs.is_on("lesson-films", "max") is False


def test_an_unknown_feature_is_never_on():
    for plan in ("free", "pro", "max"):
        assert labs.is_on("no-such-lab", plan) is False


def test_every_entry_says_what_is_rough_about_it(monkeypatch):
    """Early access to an unfinished feature is only a privilege if the learner
    is told which part is unfinished. A Labs entry with no honest caveat is
    marketing."""
    for key, entry in labs.catalogue().items():
        assert entry.get("rough"), f"{key} does not say what is still rough"
        assert entry.get("blurb"), f"{key} has no description"
        assert entry.get("stage") in labs.STAGES, key
