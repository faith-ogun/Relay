"""Build library: serve the authored builds from the backend.

Step 1 of the core learning loop is "learner picks a build", and step 2 is the
camera kit check, which measures the bench against that build's parts list. Both
were web-only, because the library lived in the web bundle
(frontend/components/ohmlet/data/library.ts) and nothing served it.

Why it moved here rather than being copied into the phone: the same reason the
curriculum did (see curriculum.py). A wrong part in a parts list shipped inside a
mobile binary takes an App Store review to correct, and that parts list is what
the vision-verifier checks a learner's bench against, so a typo there tells a
learner they are missing a component they are holding. Served, a correction
reaches every learner on both surfaces at once.

The JSON is generated from the TypeScript source by
`frontend/scripts/export-builds.mjs`, which bundles and evaluates library.ts, so
it cannot drift from what the web app compiles. Regenerate it whenever a build
changes; `tests/test_builds.py` re-reads library.ts independently and fails if
the served copy no longer matches, so a forgotten regeneration is a red test
rather than two surfaces quietly disagreeing about a parts list.

No ASSET_ORIGIN rewrite lives here, unlike curriculum.py: builds carry no art
paths, only a colour and an icon name that each client draws itself. Adding a
rewrite for a field that does not exist would be dead code. It belongs here the
day a build gains artwork.

Caching contract: identical to the curriculum's. Every response carries a content
`version`; a client stores that version alongside its cached copy, addresses its
requests by it, and only refetches when it changes.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from auth import require_uid

logger = logging.getLogger("ohmlet.builds")

# Shares the curriculum's data directory: same provenance (generated from the
# web's authored source), same lifecycle, same deploy.
DATA_DIR = Path(__file__).parent / "curriculum_data"

router = APIRouter(prefix="/v1/builds", tags=["builds"])


@lru_cache(maxsize=1)
def _catalogue() -> dict[str, Any]:
    """The whole build library. A few KB, so it is served in one piece rather
    than split into a manifest plus per-build fetches the way lessons are."""
    return json.loads((DATA_DIR / "builds.json").read_text(encoding="utf-8"))


def content_version() -> str:
    """The version stamp clients cache against."""
    try:
        return str(_catalogue().get("version", ""))
    except Exception:
        return ""


@router.get("/manifest")
def manifest(response: Response, uid: str = Depends(require_uid)) -> dict[str, Any]:
    """Every build a learner can choose: title, level, estimate, parts list.

    The parts list is the load-bearing field. It is what the learner reads before
    they sit down, and what the vision-verifier is asked to find on their bench.
    """
    try:
        data = _catalogue()
    except Exception as exc:
        logger.error("build library unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="The build library isn't available right now.")

    # Content is immutable for a given version and clients address it by that
    # version, so a long cache is safe and a change is a different URL.
    response.headers["Cache-Control"] = "private, max-age=86400"
    return {"version": data.get("version", ""), "builds": data.get("builds", [])}


@router.get("/version")
def version(uid: str = Depends(require_uid)) -> dict[str, str]:
    """Cheap poll so a client can decide whether its cached copy is stale."""
    return {"version": content_version()}
