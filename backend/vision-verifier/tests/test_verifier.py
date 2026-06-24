"""End-to-end tests for the vision-verifier endpoints.

Auth and the Gemini call are stubbed (no Firebase, no Vertex) so the tests cover
exactly the service's own logic: validation, normalization, the recomputed
`ready` flag, and graceful degradation when the upstream is unavailable.
"""

import base64
import json

import pytest
from fastapi.testclient import TestClient

import main
from main import app, guard

# A tiny but valid base64 payload (decode only needs valid, non-empty, in-size).
GOOD_IMAGE = base64.b64encode(b"not-a-real-jpeg-but-valid-base64").decode()


@pytest.fixture
def client():
    app.dependency_overrides[guard] = lambda: "test-uid"
    yield TestClient(app)
    app.dependency_overrides.clear()


class _FakeResp:
    def __init__(self, payload):
        self.text = json.dumps(payload)


class _FakeClient:
    def __init__(self, payload):
        self._payload = payload

        class _Models:
            def generate_content(_self, **kwargs):
                return _FakeResp(payload)

        self.models = _Models()


def _stub_model(monkeypatch, payload):
    monkeypatch.setattr(main, "_genai_client", lambda: _FakeClient(payload))
    # Keep the breaker closed for the test.
    main._VERIFY_CB.record_success()
    main._IDENTIFY_CB.record_success()


def test_ready_is_recomputed_from_parts(client, monkeypatch):
    # Model claims ready=true, but a part is missing -> server must override to false.
    _stub_model(monkeypatch, {
        "parts": [
            {"name": "Arduino Uno", "status": "present"},
            {"name": "LED", "status": "missing"},
        ],
        "found_extras": ["jumper wires"],
        "ready": True,
        "feedback": "Looks good!",
        "confidence": 0.9,
    })
    r = client.post("/v1/verify-inventory", json={
        "image_base64": GOOD_IMAGE,
        "expected_parts": ["Arduino Uno", "LED"],
        "build_title": "Test Build",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["ready"] is False
    statuses = {p["name"]: p["status"] for p in body["parts"]}
    assert statuses == {"Arduino Uno": "present", "LED": "missing"}
    assert body["found_extras"] == ["jumper wires"]


def test_response_anchored_to_expected_parts(client, monkeypatch):
    # Model returns an unexpected name and omits one; output must match the
    # expected list exactly, defaulting the missing one to "unsure".
    _stub_model(monkeypatch, {
        "parts": [{"name": "Something Else", "status": "present"}],
        "ready": True,
        "feedback": "",
        "confidence": 2.5,  # out of range -> clamped
    })
    r = client.post("/v1/verify-inventory", json={
        "image_base64": GOOD_IMAGE,
        "expected_parts": ["Arduino Uno", "LED"],
    })
    body = r.json()
    assert [p["name"] for p in body["parts"]] == ["Arduino Uno", "LED"]
    assert all(p["status"] == "unsure" for p in body["parts"])
    assert body["ready"] is False
    assert 0.0 <= body["confidence"] <= 1.0
    assert body["feedback"]  # falls back to a sensible default when blank


def test_all_present_is_ready(client, monkeypatch):
    _stub_model(monkeypatch, {
        "parts": [
            {"name": "Arduino Uno", "status": "present"},
            {"name": "LED", "status": "present"},
        ],
        "ready": False,  # model wrong; server should compute true
        "feedback": "Go!",
        "confidence": 0.95,
    })
    r = client.post("/v1/verify-inventory", json={
        "image_base64": GOOD_IMAGE,
        "expected_parts": ["Arduino Uno", "LED"],
    })
    assert r.json()["ready"] is True


def test_empty_expected_parts_rejected(client):
    r = client.post("/v1/verify-inventory", json={"image_base64": GOOD_IMAGE, "expected_parts": []})
    assert r.status_code == 422


def test_invalid_image_rejected(client):
    r = client.post("/v1/verify-inventory", json={
        "image_base64": "!!!not base64!!!",
        "expected_parts": ["LED"],
    })
    assert r.status_code == 422


def test_degrades_when_upstream_unavailable(client, monkeypatch):
    monkeypatch.setattr(main, "_genai_client", lambda: None)
    r = client.post("/v1/verify-inventory", json={
        "image_base64": GOOD_IMAGE,
        "expected_parts": ["LED"],
    })
    assert r.status_code == 503
    assert r.headers.get("Retry-After")


def test_identify_component(client, monkeypatch):
    _stub_model(monkeypatch, {
        "name": "LDR (photoresistor)",
        "value": None,
        "purpose": "Resistance drops as light increases.",
        "tip": "Pair it with a fixed resistor to make a voltage divider.",
        "confidence": 0.88,
    })
    r = client.post("/v1/identify-component", json={"image_base64": GOOD_IMAGE, "hint": "round sensor"})
    assert r.status_code == 200
    assert r.json()["name"].startswith("LDR")


def test_health_ok():
    c = TestClient(app)
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["service"] == "vision-verifier"
