"""The build library endpoints.

Step 1 of the core learning loop is picking a build, and step 2 measures the
learner's bench against that build's parts list with the camera. Both now depend
on this service, so what these pin down is what those two steps rely on:

  1. Every build carries a non-empty parts list. An empty one makes the
     vision-verifier answer 422 and the kit check a dead button.
  2. Ids are unique and stable, because a client remembers the learner's chosen
     build by id between sessions.
  3. The version stamp is the hash of the payload it ships with. That is what the
     mobile cache addresses by, in both its storage key and its request URL, so a
     stamp that did not move with the content would serve a stale parts list to a
     learner holding the right parts.
  4. The served catalogue still matches the web's authored source. The JSON is
     generated from frontend/components/ohmlet/data/library.ts, and this is what
     makes forgetting to regenerate a red test rather than two surfaces quietly
     disagreeing about what is in the kit.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import builds
from auth import require_uid

REQUIRED_FIELDS = ("id", "title", "level", "est", "mode", "color", "icon", "desc", "parts")

# The authored source the served JSON is generated from. Absent inside the Cloud
# Run build context, which ships backend/live-bridge alone.
WEB_SOURCE = Path(__file__).resolve().parents[3] / "frontend/components/ohmlet/data/library.ts"


@pytest.fixture(scope="module")
def client() -> TestClient:
    """The router alone, with auth stubbed. Mounting `main` would drag in ADK and
    a Vertex client to test two static JSON endpoints."""
    app = FastAPI()
    app.include_router(builds.router)
    app.dependency_overrides[require_uid] = lambda: "test-uid"
    return TestClient(app)


# ── The catalogue itself ─────────────────────────────────────────────────────

def test_catalogue_loads_with_a_version():
    data = builds._catalogue()
    assert data["version"], "no version stamp: every client caches against this"
    assert data["builds"], "the library is empty"


def test_every_build_is_complete():
    for b in builds._catalogue()["builds"]:
        missing = [f for f in REQUIRED_FIELDS if not b.get(f)]
        assert not missing, f"{b.get('id') or b.get('title')} is missing {missing}"
        assert re.fullmatch(r"#[0-9a-fA-F]{6}", b["color"]), f"{b['id']} has an unusable colour"


def test_every_build_has_a_parts_list_the_kit_check_can_use():
    """The vision-verifier answers 422 for an empty expected_parts, so a build
    without one would render a kit check button that cannot ever succeed."""
    for b in builds._catalogue()["builds"]:
        parts = b["parts"]
        assert isinstance(parts, list) and parts, f"{b['id']} has no parts"
        assert all(isinstance(p, str) and p.strip() for p in parts), f"{b['id']} has a blank part"
        assert len(set(parts)) == len(parts), f"{b['id']} lists the same part twice"


def test_build_ids_are_unique_and_url_safe():
    """A client stores the learner's chosen build by id and puts it in no URL of
    its own, but a colliding id would silently reselect the wrong build."""
    ids = [b["id"] for b in builds._catalogue()["builds"]]
    assert len(ids) == len(set(ids)), f"duplicate build ids: {ids}"
    for i in ids:
        assert re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", i), f"{i} is not a clean slug"


def test_version_is_the_hash_of_what_ships_with_it():
    """The exporter stamps sha256(JSON.stringify(builds))[:16]. Recomputing it
    here catches a hand-edited builds.json, whose content would change while the
    version every cache keys on stayed put."""
    data = builds._catalogue()
    payload = json.dumps(data["builds"], separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    assert data["version"] == digest, (
        "builds.json was edited by hand. Regenerate it with "
        "`node scripts/export-builds.mjs` from frontend/."
    )


# ── The endpoints ────────────────────────────────────────────────────────────

def test_manifest_serves_the_catalogue(client: TestClient):
    res = client.get("/v1/builds/manifest")
    assert res.status_code == 200
    body = res.json()
    assert body["version"] == builds.content_version()
    assert len(body["builds"]) == len(builds._catalogue()["builds"])
    assert body["builds"][0]["parts"], "the parts list must survive the response model"


def test_manifest_lets_clients_cache_hard(client: TestClient):
    """Clients address this by version, so within a version the bytes never
    change and the phone should not refetch them."""
    res = client.get("/v1/builds/manifest")
    assert res.headers["cache-control"] == "private, max-age=86400"


def test_version_endpoint_agrees_with_the_manifest(client: TestClient):
    """The poll a client makes before deciding its cache is stale. If these two
    ever disagreed, a client would refetch forever or never."""
    probe = client.get("/v1/builds/version")
    assert probe.status_code == 200
    assert probe.json()["version"] == client.get("/v1/builds/manifest").json()["version"]


def test_both_endpoints_require_a_signed_in_learner():
    """No dependency override here: the real require_uid must reject an
    anonymous request, on both routes."""
    app = FastAPI()
    app.include_router(builds.router)
    anon = TestClient(app)
    assert anon.get("/v1/builds/manifest").status_code == 401
    assert anon.get("/v1/builds/version").status_code == 401


# ── The guard against drifting from the web's authored source ────────────────

def _unescape(value: str) -> str:
    return re.sub(r"\\(.)", r"\1", value)


def _string_field(block: str, key: str) -> str | None:
    m = re.search(rf"\b{key}:\s*(['\"])((?:\\.|(?!\1).)*)\1", block, re.S)
    return _unescape(m.group(2)) if m else None


def _parse_library(source: str) -> list[dict]:
    """Read BUILD_LIBRARY out of the TypeScript by hand.

    Deliberately independent of the exporter: if this reused the generated JSON,
    or the exporter's own parsing, it could not detect the thing it exists to
    detect. It reads the authored file the way a person would, and any failure to
    parse is raised rather than skipped, because a silently empty result would
    make this test pass by proving nothing.
    """
    start = source.index("BUILD_LIBRARY")
    start = source.index("[", start)
    depth, end = 0, None
    for i in range(start, len(source)):
        if source[i] == "[":
            depth += 1
        elif source[i] == "]":
            depth -= 1
            if depth == 0:
                end = i
                break
    assert end is not None, "BUILD_LIBRARY's array is unterminated"
    body = source[start + 1:end]

    # Split the array into its top-level object literals.
    blocks, depth, opened = [], 0, None
    for i, ch in enumerate(body):
        if ch == "{":
            if depth == 0:
                opened = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and opened is not None:
                blocks.append(body[opened:i + 1])
                opened = None
    assert blocks, "no build objects found in BUILD_LIBRARY"

    parsed = []
    for block in blocks:
        parts_match = re.search(r"\bparts:\s*\[(.*?)\]", block, re.S)
        assert parts_match, f"a build has no parts array: {block[:80]}"
        icon_match = re.search(r"\bicon:\s*([A-Za-z_$][\w$]*)", block)
        assert icon_match, f"a build has no icon: {block[:80]}"
        entry = {
            "icon": icon_match.group(1),
            "parts": [
                _unescape(m.group(2))
                for m in re.finditer(r"(['\"])((?:\\.|(?!\1).)*)\1", parts_match.group(1))
            ],
        }
        for key in ("title", "level", "est", "mode", "color", "desc"):
            value = _string_field(block, key)
            assert value, f"a build is missing {key}: {block[:80]}"
            entry[key] = value
        parsed.append(entry)
    return parsed


def _slug(title: str) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", title.lower()))


@pytest.mark.skipif(not WEB_SOURCE.exists(), reason="frontend/ is not in this build context")
def test_served_catalogue_still_matches_the_web_source():
    """The served copy is generated from library.ts. If someone edits a build on
    the web and does not rerun `node scripts/export-builds.mjs`, the phone would
    keep checking benches against the old parts list. This is what stops that
    being silent."""
    authored = _parse_library(WEB_SOURCE.read_text(encoding="utf-8"))
    served = builds._catalogue()["builds"]

    assert len(served) == len(authored), (
        f"the web authors {len(authored)} builds and the backend serves {len(served)}. "
        "Regenerate builds.json with `node scripts/export-builds.mjs` from frontend/."
    )
    for want, got in zip(authored, served):
        assert got["id"] == _slug(want["title"]), f"{got['id']} is not the slug of {want['title']}"
        for key in ("title", "level", "est", "mode", "color", "icon", "desc", "parts"):
            assert got[key] == want[key], (
                f"{got['id']}.{key} has drifted from library.ts: "
                f"serving {got[key]!r}, authored {want[key]!r}. "
                "Regenerate builds.json with `node scripts/export-builds.mjs` from frontend/."
            )
