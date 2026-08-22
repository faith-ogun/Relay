"""Curriculum service: serve the authored lessons from the backend (#70).

Why this exists. The 142 lessons used to be compiled into the web client. That
is tolerable on the web, where a fix is a deploy, but not on mobile, where it
would be an App Store review — days to correct a typo in one question. Serving
the content means a lesson fix reaches every learner on both surfaces at once,
and keeps the authored curriculum out of any client bundle.

Design decision: metadata/decisions/2026-08-22_curriculum-client-vs-backend.md

The JSON is generated from the TypeScript source by
`frontend/scripts/export-curriculum.mjs`, so it can never drift from what the
web app compiles. Regenerate it whenever a lesson changes.

Caching contract: every response carries a content `version`. A client stores
that version alongside its cached copy and only refetches when the version
changes, so the app works offline and costs one small request on a cold start.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from auth import require_uid

logger = logging.getLogger("ohmlet.curriculum")

DATA_DIR = Path(__file__).parent / "curriculum_data"

router = APIRouter(prefix="/v1/curriculum", tags=["curriculum"])


@lru_cache(maxsize=1)
def _curriculum() -> dict[str, Any]:
    """The unit/skill/lesson structure. Small (~28KB), safe to hold in memory."""
    return json.loads((DATA_DIR / "curriculum.json").read_text())


@lru_cache(maxsize=1)
def _lessons() -> dict[str, Any]:
    """Full lesson content, keyed by lesson id. ~700KB, loaded once per instance."""
    return json.loads((DATA_DIR / "lessons.json").read_text())


def content_version() -> str:
    """The version stamp clients cache against."""
    try:
        return str(_curriculum().get("version", ""))
    except Exception:
        return ""


@router.get("/manifest")
def manifest(uid: str = Depends(require_uid)) -> dict[str, Any]:
    """The full learning path: units, skills, lesson ids, difficulty, ordering.

    Deliberately excludes lesson bodies so a client can render the path, show
    progress, and decide what to download without pulling ~700KB it may not need.
    """
    try:
        data = _curriculum()
    except Exception as exc:
        logger.error("curriculum manifest unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="The curriculum isn't available right now.")
    return {"version": data.get("version", ""), "units": data.get("units", [])}


@router.get("/lessons/{lesson_id}")
def lesson(lesson_id: str, response: Response, uid: str = Depends(require_uid)) -> dict[str, Any]:
    """One lesson's steps. Lesson ids are authored, human-readable strings
    (e.g. "The Closed Loop"), so they arrive URL-encoded and are matched
    verbatim against the authored key rather than slugified."""
    key = (lesson_id or "").strip()
    if not key or len(key) > 200:
        raise HTTPException(status_code=422, detail="Invalid lesson id.")

    try:
        store = _lessons()
    except Exception as exc:
        logger.error("lesson store unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="The curriculum isn't available right now.")

    found = store.get("lessons", {}).get(key)
    if found is None:
        raise HTTPException(status_code=404, detail="Lesson not found.")

    # Content is immutable for a given version, so let clients cache hard and
    # rely on the version stamp for invalidation.
    response.headers["Cache-Control"] = "private, max-age=86400"
    return {"version": store.get("version", ""), "id": key, "lesson": found}


@router.get("/version")
def version(uid: str = Depends(require_uid)) -> dict[str, str]:
    """Cheap poll so a client can decide whether its cache is stale."""
    return {"version": content_version()}
