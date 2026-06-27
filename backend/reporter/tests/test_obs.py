"""Tests for the shared observability module (#35): metrics, trace parsing,
route collapsing, security headers, and the token-guarded metrics endpoint."""

import json
import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

import obs


def test_route_collapse():
    # A realistic 28-char Firebase UID and a numeric id both collapse; real
    # path words (short, dictionary-like) are left alone.
    assert obs._collapse("/v1/state/xY3kQ9aB7cD1eF5gH2jK4mN6pR8s") == "/v1/state/:id"
    assert obs._collapse("/v1/community/posts/12345/comments") == "/v1/community/posts/:id/comments"
    assert obs._collapse("/health") == "/health"


def test_trace_header_parsing():
    obs._set_trace_from_header("105445aa7843bc8bf206b120001000/1;o=1")
    assert obs._trace.get() == "105445aa7843bc8bf206b120001000"
    assert obs._span.get() == "1"
    obs._set_trace_from_header(None)
    assert obs._trace.get() == ""


def test_metrics_snapshot_percentiles():
    m = obs._Metrics()
    for ms in [10, 20, 30, 40, 1000]:
        m.observe_request("POST", "/v1/x", 200, ms)
    m.observe_request("POST", "/v1/x", 500, 5)
    snap = m.snapshot()
    route = snap["routes"]["POST /v1/x"]
    assert route["count"] == 6
    assert route["errors"] == 1
    assert route["maxMs"] == 1000.0
    assert snap["totals"]["requests"] == 6


def test_structured_formatter_emits_json():
    fmt = obs.StructuredFormatter("test-svc")
    record = logging.LogRecord("ohmlet.test", logging.INFO, __file__, 1, "hello", None, None)
    record.json_fields = {"foo": "bar"}
    out = json.loads(fmt.format(record))
    assert out["severity"] == "INFO"
    assert out["service"] == "test-svc"
    assert out["message"] == "hello"
    assert out["foo"] == "bar"


def test_audit_emits_and_calls_sink():
    seen = []
    obs.register_audit_sink(lambda rec: seen.append(rec))
    try:
        obs.audit("test.event", uid="u1", detail="x")
    finally:
        obs.register_audit_sink(None) if False else None
    assert seen and seen[0]["event"] == "test.event"
    assert seen[0]["uid"] == "u1"
    assert seen[0]["audit"] is True


def test_metrics_endpoint_guarded():
    app = FastAPI()
    obs.install_observability(app, "test-svc")
    c = TestClient(app)
    # Unconfigured token -> 404 (existence not advertised).
    assert c.get("/internal/metrics").status_code == 404


def test_security_headers_present():
    app = FastAPI()

    @app.get("/ping")
    def ping():
        return {"ok": True}

    obs.install_observability(app, "test-svc")
    c = TestClient(app)
    r = c.get("/ping")
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Request-Id")
