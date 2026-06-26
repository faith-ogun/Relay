"""Community layer (#63) — pure helpers (the Firestore paths are smoke-tested
live against the deployed service)."""

import re

import community


def test_week_key_format():
    assert re.fullmatch(r"\d{4}-W\d{2}", community._week_key())


def test_clean_trims_and_caps():
    assert community._clean("  hi  ", 10) == "hi"
    assert community._clean("x" * 50, 10) == "x" * 10
    assert community._clean(None, 10) == ""
    assert community._clean(123, 10) == ""


def test_display_name_prefers_name_then_email_then_default():
    assert community._display_name({"name": "Ada Lovelace"}) == "Ada Lovelace"
    assert community._display_name({"email": "faith@ohmlet.org"}) == "faith"
    assert community._display_name({}) == "Builder"


def test_kinds_and_caps_are_sane():
    assert community.KINDS == {"build", "win", "question"}
    assert community.MAX_TITLE > 0 and community.MAX_BODY > community.MAX_TITLE


# Art keys the client knows how to render (keep in sync with ChallengeArt.tsx).
_KNOWN_ART = {"streak", "nokit", "teachback", "sensors", "debug", "firstlight"}
_KNOWN_THEMES = {"red", "blue", "green", "gold", "violet", "indigo"}


def test_default_challenges_are_well_formed():
    chs = community.DEFAULT_CHALLENGES
    assert len(chs) >= 4, "we promised more than the original three challenges"
    ids = [c["id"] for c in chs]
    assert len(ids) == len(set(ids)), "challenge ids must be unique"
    orders = [c["order"] for c in chs]
    assert len(orders) == len(set(orders)), "challenge order must be unique"
    for c in chs:
        for field in ("id", "title", "tagline", "desc", "longDesc", "reward", "goal", "durationDays", "art", "theme", "order"):
            assert c.get(field) not in (None, ""), f"{c.get('id')} missing {field}"
        assert c["art"] in _KNOWN_ART, f"{c['id']} has art the client can't render: {c['art']}"
        assert c["theme"] in _KNOWN_THEMES, f"{c['id']} has an unknown theme: {c['theme']}"
        assert len(c["longDesc"]) > len(c["desc"]), f"{c['id']} longDesc should expand on desc"
        assert isinstance(c["durationDays"], int) and c["durationDays"] > 0
