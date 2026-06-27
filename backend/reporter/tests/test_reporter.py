"""Reporter (#31) — pure helpers + provider selection (the GCS/Firestore paths
are smoke-tested live against the deployed service)."""

import base64

import pytest

import entitlements
import providers
import validation


# ── validation ──
def test_decode_image_accepts_data_url_and_plain_b64():
    raw = b"\x89PNG\r\n\x1a\n fake png bytes"
    b64 = base64.b64encode(raw).decode()
    assert validation.decode_image(b64) == raw
    assert validation.decode_image("data:image/png;base64," + b64) == raw


def test_decode_image_rejects_empty_and_bad():
    with pytest.raises(Exception):
        validation.decode_image("")
    with pytest.raises(Exception):
        validation.decode_image("not%%%base64")


def test_decode_image_rejects_oversize(monkeypatch):
    monkeypatch.setattr(validation, "MAX_IMAGE_B64_CHARS", 8)
    with pytest.raises(Exception):
        validation.decode_image(base64.b64encode(b"way too many bytes here").decode())


def test_clean_title_and_id():
    assert validation.clean_title("  Light Alarm  ") == "Light Alarm"
    assert validation.clean_title("") == "My build"
    assert validation.clean_title(None, "fallback") == "fallback"
    assert validation.clean_id("sess/../../etc") == "sess....etc"
    assert validation.clean_id("ok_id-1.2") == "ok_id-1.2"
    assert validation.clean_id(123) == ""


# ── provider selection ──
def test_get_provider_none_when_unconfigured(monkeypatch):
    monkeypatch.setenv("OHMLET_TWIN_PROVIDER", "stability")
    monkeypatch.delenv("STABILITY_API_KEY", raising=False)
    assert providers.get_provider() is None


def test_get_provider_disabled(monkeypatch):
    monkeypatch.setenv("OHMLET_TWIN_PROVIDER", "none")
    assert providers.get_provider() is None


def test_get_provider_stability_when_keyed(monkeypatch):
    monkeypatch.setenv("OHMLET_TWIN_PROVIDER", "stability")
    monkeypatch.setenv("STABILITY_API_KEY", "sk-test")
    p = providers.get_provider()
    assert p is not None and p.name == "stability"


def test_stability_provider_returns_glb_on_200(monkeypatch):
    p = providers.StabilityProvider("sk-test")

    class FakeResp:
        status_code = 200
        content = b"glTF-binary-bytes"

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, *a, **k):
            return FakeResp()

    monkeypatch.setattr(providers.httpx, "Client", FakeClient)
    assert p.generate(b"png") == b"glTF-binary-bytes"


def test_stability_provider_raises_on_quota(monkeypatch):
    p = providers.StabilityProvider("sk-test")

    class FakeResp:
        status_code = 429
        text = "rate limited"

        def json(self):
            return {"message": "slow down"}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, *a, **k):
            return FakeResp()

    monkeypatch.setattr(providers.httpx, "Client", FakeClient)
    with pytest.raises(providers.TwinGenerationError):
        p.generate(b"png")


# ── entitlements ──
def test_monthly_quota_per_plan(monkeypatch):
    monkeypatch.setattr(entitlements, "TWINS_PER_MONTH", {"free": 1, "pro": 30, "max": 100})
    assert entitlements.monthly_quota("free") == 1
    assert entitlements.monthly_quota("pro") == 30
    assert entitlements.monthly_quota("max") == 100
    assert entitlements.monthly_quota("bogus") == 1  # normalises to free


def test_period_is_year_month():
    import re

    assert re.fullmatch(r"\d{4}-\d{2}", entitlements.period())
