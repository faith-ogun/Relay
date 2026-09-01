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


# ── X-Forwarded-For spoofing ────────────────────────────────────────────────

class _FakeClient:
    def __init__(self, host):
        self.host = host


class _FakeRequest:
    def __init__(self, xff=None, peer="10.0.0.1"):
        self.headers = {"x-forwarded-for": xff} if xff else {}
        self.client = _FakeClient(peer)


def test_client_ip_ignores_forged_leading_entry():
    """A caller that sends its own X-Forwarded-For has that value preserved and
    the real address appended after it. Reading position 0 read the forgery."""
    req = _FakeRequest(xff="1.2.3.4, 203.0.113.9")
    assert ratelimit._client_ip(req) == "203.0.113.9"


def test_client_ip_rotating_forgery_yields_one_bucket():
    """The actual exploit: rotate the header, get unlimited buckets."""
    seen = {
        ratelimit._client_ip(_FakeRequest(xff=f"9.9.9.{i}, 203.0.113.9"))
        for i in range(50)
    }
    assert seen == {"203.0.113.9"}


def test_client_ip_single_hop():
    assert ratelimit._client_ip(_FakeRequest(xff="203.0.113.9")) == "203.0.113.9"


def test_client_ip_falls_back_to_socket_without_header():
    assert ratelimit._client_ip(_FakeRequest()) == "10.0.0.1"


def test_client_ip_handles_whitespace_and_empties():
    assert ratelimit._client_ip(_FakeRequest(xff=" 1.2.3.4 , , 203.0.113.9 ")) == "203.0.113.9"
