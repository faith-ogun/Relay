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
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from auth import require_uid

import entitlements
import films
import labs

logger = logging.getLogger("ohmlet.curriculum")

DATA_DIR = Path(__file__).parent / "curriculum_data"

router = APIRouter(prefix="/v1/curriculum", tags=["curriculum"])


@lru_cache(maxsize=1)
def _curriculum() -> dict[str, Any]:
    """The unit/skill/lesson structure. Small (~28KB), safe to hold in memory."""
    return json.loads((DATA_DIR / "curriculum.json").read_text())


# Where the achievement artwork is served from.
#
# Deliberately NOT OHMLET_APP_URL: that points at ohmlet.org, which is still a
# Namecheap parking page, so building asset URLs from it would 404 every medal
# until DNS is switched. The Firebase Hosting origin serves the files today and
# keeps serving them after the custom domain is attached.
ASSET_ORIGIN = os.getenv("OHMLET_ASSET_ORIGIN", "https://ohmlet-app.web.app").rstrip("/")


def _absolute_art(item: dict[str, Any]) -> dict[str, Any]:
    """Turn a root-relative art path into a URL a native client can load.

    The catalogue stores `/achievements/build-1.webp`, which resolves fine in a
    browser and means nothing on a phone: there is no document origin to resolve
    it against. Mobile rendered a plain coloured disc instead, so all 50 medals
    were art-less. Rewriting server-side fixes both clients at once and keeps the
    authored JSON origin-agnostic.
    """
    art = item.get("art")
    if isinstance(art, str) and art.startswith("/"):
        return {**item, "art": f"{ASSET_ORIGIN}{art}"}
    return item


@lru_cache(maxsize=1)
def _achievements() -> dict[str, Any]:
    """The achievement catalogue. Small, and identical for every learner —
    only which ones are EARNED differs, and that is computed client-side from
    the learner's own metrics."""
    return json.loads((DATA_DIR / "achievements.json").read_text())


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


@router.get("/achievements")
def achievements(uid: str = Depends(require_uid)) -> dict[str, Any]:
    """The full achievement catalogue: titles, thresholds, tiers and art keys.

    Served rather than bundled for the same reason as the lessons — the set
    grows, and a new achievement should not need an App Store review.
    """
    try:
        data = _achievements()
    except Exception as exc:
        logger.error("achievements unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Achievements aren't available right now.")
    items = [_absolute_art(a) for a in data.get("achievements", [])]
    return {"version": data.get("version", ""), "achievements": items}


@router.get("/films/{skill_id}")
def film(skill_id: str, uid: str = Depends(require_uid)) -> dict[str, Any]:
    """Short-lived signed URLs for one skill's lesson film.

    Gated through Labs rather than through a plan check directly, because the
    films themselves are free for everyone by decision: what is gated is early
    access to the PLAYER while it is unfinished. When it graduates, the stage
    moves to `all` and this gate opens for every plan without a code change.

    Three distinct failures, three distinct answers, because "no film" and "we
    cannot serve films" are not the same thing to a learner staring at a spinner.
    """
    key = (skill_id or "").strip()
    if not key or len(key) > 100:
        raise HTTPException(status_code=422, detail="Invalid skill id.")

    plan = entitlements.get_plan(uid)
    if not labs.is_on("lesson-films", plan):
        raise HTTPException(
            status_code=402,
            detail="Lesson films are in Ohmlet Labs, an early-access feature for Max.",
        )

    try:
        return films.urls_for(key)
    except KeyError:
        raise HTTPException(status_code=404, detail="There is no film for this skill.")
    except RuntimeError:
        logger.error("film signing unavailable for %s", key)
        raise HTTPException(status_code=503, detail="Films aren't available right now.")
