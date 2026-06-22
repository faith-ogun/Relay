"""Rate limiting (#47) — sliding-window allow/deny."""

import types

import pytest
from fastapi import HTTPException

import ratelimit


def _req(ip="1.2.3.4"):
    return types.SimpleNamespace(
        headers={"x-forwarded-for": ip},
        client=types.SimpleNamespace(host=ip),
    )


def test_rest_allows_up_to_limit_then_429(monkeypatch):
    monkeypatch.setattr(ratelimit, "_REST_MAX", 3)
    req = _req("9.9.9.9")
    for _ in range(3):
        ratelimit.enforce_rest(req, identity="rl-test-a")  # within limit -> no raise
    with pytest.raises(HTTPException) as exc:
        ratelimit.enforce_rest(req, identity="rl-test-a")
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers


def test_rest_buckets_are_per_identity(monkeypatch):
    monkeypatch.setattr(ratelimit, "_REST_MAX", 1)
    req = _req()
    ratelimit.enforce_rest(req, identity="rl-test-b")
    # a different identity is unaffected
    ratelimit.enforce_rest(req, identity="rl-test-c")
    with pytest.raises(HTTPException):
        ratelimit.enforce_rest(req, identity="rl-test-b")


def test_ws_session_cap(monkeypatch):
    monkeypatch.setattr(ratelimit, "_WS_MAX", 2)
    assert ratelimit.allow_ws_session("rl-ws-test") is True
    assert ratelimit.allow_ws_session("rl-ws-test") is True
    assert ratelimit.allow_ws_session("rl-ws-test") is False
