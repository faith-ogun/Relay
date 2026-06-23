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
