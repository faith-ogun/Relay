"""Input validation + size limits (#45)."""

import pytest
from fastapi import HTTPException

import validation


def test_state_envelope_passes_a_valid_shape():
    payload = {"version": 1, "data": {"xp": 5}, "updatedAt": "2026-01-01T00:00:00Z"}
    assert validation.validate_state_envelope(payload) == payload


def test_state_envelope_rejects_non_object():
    with pytest.raises(HTTPException) as exc:
        validation.validate_state_envelope([1, 2, 3])
    assert exc.value.status_code == 422


def test_state_envelope_rejects_oversized(monkeypatch):
    monkeypatch.setattr(validation, "MAX_STATE_BYTES", 50)
    with pytest.raises(HTTPException) as exc:
        validation.validate_state_envelope({"data": {"x": "y" * 200}})
    assert exc.value.status_code == 413


def test_state_envelope_rejects_bad_version_type():
    with pytest.raises(HTTPException) as exc:
        validation.validate_state_envelope({"version": "1"})
    assert exc.value.status_code == 422


def test_ws_text_truncates_and_coerces(monkeypatch):
    monkeypatch.setattr(validation, "MAX_WS_TEXT_CHARS", 5)
    assert validation.validate_ws_text("abcdefgh") == "abcde"
    assert validation.validate_ws_text("ok") == "ok"
    assert validation.validate_ws_text(123) == ""  # non-string -> empty


def test_ws_image_bounds():
    assert validation.ws_image_ok(100) is True
    assert validation.ws_image_ok(0) is False
    assert validation.ws_image_ok(validation.MAX_WS_IMAGE_BYTES + 1) is False


def test_normalize_stage_only_accepts_known():
    assert validation.normalize_stage("wiring", "inventory") == "wiring"
    assert validation.normalize_stage("bogus", "inventory") == "inventory"
    assert validation.normalize_stage(123, "code") == "code"
