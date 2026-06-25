"""Tests for the Arduino compile service (#73).

The toolchain isn't present in CI, so we stub `subprocess.run` and exercise the
service logic: validation, the success path (hex returned), compile-error
parsing, board allow-listing, and the timeout path.
"""

import subprocess
import types

import pytest
from fastapi.testclient import TestClient

import main
from main import app, guard

BLINK = "void setup(){pinMode(13,OUTPUT);}\nvoid loop(){digitalWrite(13,HIGH);delay(500);digitalWrite(13,LOW);delay(500);}\n"


@pytest.fixture
def client():
    app.dependency_overrides[guard] = lambda: "test-uid"
    yield TestClient(app)
    app.dependency_overrides.clear()


def _fake_run(returncode, stdout="", stderr="", hex_text="", make_hex=True):
    def run(cmd, **kwargs):
        if returncode == 0 and make_hex:
            # cmd build path is "--build-path <dir>"; drop the hex where main reads it
            import os
            bp = cmd[cmd.index("--build-path") + 1]
            os.makedirs(bp, exist_ok=True)
            with open(os.path.join(bp, "sketch.ino.hex"), "w") as f:
                f.write(hex_text or ":00000001FF\n")
        return types.SimpleNamespace(returncode=returncode, stdout=stdout, stderr=stderr)
    return run


def test_compile_success(client, monkeypatch):
    monkeypatch.setattr(subprocess, "run", _fake_run(0, stdout="Sketch uses 924 bytes (2%)...\nGlobal variables use 9 bytes (0%)...", hex_text=":100000000C9434000C9446000C9446000C94460082\n:00000001FF\n"))
    r = client.post("/v1/compile", json={"source": BLINK})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["hex"].startswith(":10")
    assert body["text_bytes"] == 924
    assert body["data_bytes"] == 9


def test_compile_error_parsed(client, monkeypatch):
    stderr = "/tmp/sketch/sketch.ino:2:3: error: 'pinMod' was not declared in this scope\n"
    monkeypatch.setattr(subprocess, "run", _fake_run(1, stderr=stderr))
    r = client.post("/v1/compile", json={"source": "void loop(){pinMod(13,1);}"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert body["errors"][0]["line"] == 2
    assert "pinMod" in body["errors"][0]["message"]


def test_empty_source_rejected(client):
    r = client.post("/v1/compile", json={"source": "   "})
    assert r.status_code == 422


def test_oversized_source_rejected(client):
    r = client.post("/v1/compile", json={"source": "x" * (64 * 1024 + 1)})
    assert r.status_code == 413


def test_bad_board_rejected(client):
    r = client.post("/v1/compile", json={"source": BLINK, "fqbn": "evil:board:x"})
    assert r.status_code == 422


def test_timeout(client, monkeypatch):
    def boom(cmd, **kwargs):
        raise subprocess.TimeoutExpired(cmd, 25)
    monkeypatch.setattr(subprocess, "run", boom)
    r = client.post("/v1/compile", json={"source": BLINK})
    assert r.status_code == 408


def test_health_ok():
    assert TestClient(app).get("/health").json()["status"] == "ok"
