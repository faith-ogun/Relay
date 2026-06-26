"""Community persistence (#63) — the social layer that fights churn.

Grounded in Duolingo's retention playbook (loss aversion + social pressure +
winnable weekly competition):
  - Feed: builders post wins/builds/questions; others react and comment. The
    posts + reactions are the user's *investment* (the Hook model's 4th step) —
    what makes leaving costly.
  - Challenges: shared, time-boxed goals. "Friends don't let friends down" —
    joining a challenge with a visible participant count is light social pressure.
  - Weekly league: a leaderboard that RESETS every week (ISO week), so status is
    winnable and never a permanent hierarchy — asymmetric loss aversion each week.

Everything is server-authoritative and token-scoped: the author/uid come from the
verified token, never the client (same isolation contract as #44). Counters use
Firestore atomic increments. All reads/writes go through the Admin SDK.
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from auth import require_claims
from cache import TTLCache

logger = logging.getLogger("ohmlet.community")

# The weekly league's top-100 is identical for every user and is read on every
# Community open, so cache it briefly per ISO-week (#52). `me` is always computed
# fresh, and report_xp invalidates the week so a user sees their own gain at once.
_LEADERBOARD_TTL = float(os.getenv("OHMLET_LEADERBOARD_CACHE_TTL", "20"))
_leaderboard_cache = TTLCache(ttl=_LEADERBOARD_TTL)

router = APIRouter(prefix="/v1/community", tags=["community"])

POSTS = os.getenv("OHMLET_POSTS_COLLECTION", "community_posts")
COMMENTS = os.getenv("OHMLET_COMMENTS_COLLECTION", "community_comments")
REACTIONS = os.getenv("OHMLET_REACTIONS_COLLECTION", "community_reactions")
CHALLENGES = os.getenv("OHMLET_CHALLENGES_COLLECTION", "community_challenges")
MEMBERS = os.getenv("OHMLET_CHALLENGE_MEMBERS_COLLECTION", "community_challenge_members")
LEADERBOARD = os.getenv("OHMLET_LEADERBOARD_COLLECTION", "community_leaderboard")

KINDS = {"build", "win", "question"}
MAX_TITLE = 140
MAX_BODY = 5000
MAX_COMMENT = 2000
FEED_LIMIT = 30

# Seeded weekly challenges — real, joinable, electronics-flavoured (no "coming soon").
# Each carries a short `desc` (shown on the card) and a richer `longDesc` (shown in
# the join dialog), plus a `goal`, a `durationDays`, an `art` key (selects the hero
# illustration on the client) and a `theme` colour. `order` fixes display order.
DEFAULT_CHALLENGES = [
    {
        "id": "streak7",
        "title": "7-Day Streak",
        "tagline": "Show up every day",
        "desc": "Build or learn something every day this week.",
        "longDesc": (
            "Real skill comes from showing up. Complete at least one lesson or build "
            "every day for seven days in a row. Miss a day and the streak resets, so "
            "protect it. Finish all seven and the habit starts to stick."
        ),
        "reward": "+150 XP",
        "goal": "7 days in a row",
        "durationDays": 7,
        "art": "streak",
        "theme": "red",
        "order": 1,
    },
    {
        "id": "nokit",
        "title": "No-Kit Hero",
        "tagline": "Improvise like a real engineer",
        "desc": "Complete a build using only loose parts, no starter kit.",
        "longDesc": (
            "Anyone can follow a kit. This week, complete a full build from a pile of "
            "loose components: no labelled trays, no guided slots. You will lean on what "
            "you actually understand about each part. Pull it off and you have earned the cape."
        ),
        "reward": "Champion badge",
        "goal": "1 freeform build",
        "durationDays": 7,
        "art": "nokit",
        "theme": "blue",
        "order": 2,
    },
    {
        "id": "teachback",
        "title": "Teach It Back",
        "tagline": "If you can teach it, you know it",
        "desc": "Post a build and explain how it works in your own words.",
        "longDesc": (
            "The fastest way to lock in a concept is to explain it. Share one build to "
            "the community and walk through how it works in plain language, as if teaching "
            "a friend. Bonus respect for covering what you would do differently next time."
        ),
        "reward": "+80 XP",
        "goal": "1 explained post",
        "durationDays": 7,
        "art": "teachback",
        "theme": "green",
        "order": 3,
    },
    {
        "id": "sensors",
        "title": "Sensor Safari",
        "tagline": "Read the physical world",
        "desc": "Use three different sensors in your builds this week.",
        "longDesc": (
            "Sensors are how a circuit feels its surroundings. Work a light sensor, a "
            "temperature sensor, and a button or motion trigger into your builds this week. "
            "Three different ways of turning the physical world into a signal your Arduino can act on."
        ),
        "reward": "+120 XP",
        "goal": "3 sensor types",
        "durationDays": 7,
        "art": "sensors",
        "theme": "gold",
        "order": 4,
    },
    {
        "id": "debug",
        "title": "Debug Duel",
        "tagline": "Find the fault, fix the circuit",
        "desc": "Repair five broken circuits in the Simulator.",
        "longDesc": (
            "Debugging is the real job. Jump into the Simulator and fix five circuits that "
            "have been deliberately broken: a swapped resistor, a backwards diode, a floating "
            "input. Each fix sharpens the instinct for spotting what is wrong before the smoke does."
        ),
        "reward": "Fixer badge",
        "goal": "5 circuits fixed",
        "durationDays": 7,
        "art": "debug",
        "theme": "violet",
        "order": 5,
    },
    {
        "id": "firstlight",
        "title": "First Light",
        "tagline": "Your first three wins",
        "desc": "Finish your first three lessons.",
        "longDesc": (
            "Every builder remembers their first glowing LED. New here? Complete your first "
            "three lessons to get the fundamentals under your hands: current, voltage, and a "
            "working circuit you built yourself. The community is cheering you on."
        ),
        "reward": "+60 XP",
        "goal": "3 lessons done",
        "durationDays": 14,
        "art": "firstlight",
        "theme": "indigo",
        "order": 6,
    },
]


def _client():
    from state_store import get_client  # lazy: avoid circular import at module load

    return get_client()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _week_key() -> str:
    """ISO year-week, e.g. 2026-W26 — the league resets on this boundary."""
    y, w, _ = datetime.now(timezone.utc).isocalendar()
    return f"{y}-W{w:02d}"


def _display_name(claims: dict) -> str:
    name = (claims.get("name") or "").strip()
    if name:
        return name[:60]
    email = claims.get("email") or ""
    if "@" in email:
        return email.split("@", 1)[0][:60]
    return "Builder"


def _clean(text: object, cap: int) -> str:
    if not isinstance(text, str):
        return ""
    return text.strip()[:cap]


# ── Feed ──
@router.post("/posts")
async def create_post(request: Request, claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    try:
        body = await request.json()
    except Exception:
        body = {}
    kind = body.get("kind") if isinstance(body, dict) else None
    kind = kind if kind in KINDS else "build"
    title = _clean(body.get("title") if isinstance(body, dict) else "", MAX_TITLE)
    text = _clean(body.get("body") if isinstance(body, dict) else "", MAX_BODY)
    if not title and not text:
        raise HTTPException(422, "A post needs a title or some text.")

    client = _client()
    ref = client.collection(POSTS).document()
    doc = {
        "id": ref.id,
        "uid": uid,
        "authorName": _display_name(claims),
        "kind": kind,
        "title": title,
        "body": text,
        "likes": 0,
        "comments": 0,
        "createdAt": _now(),
    }
    ref.set(doc)
    return {**doc, "liked": False}


@router.get("/posts")
def list_posts(claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    client = _client()
    posts = []
    for snap in (
        client.collection(POSTS).order_by("createdAt", direction=firestore.Query.DESCENDING).limit(FEED_LIMIT).stream()
    ):
        p = snap.to_dict() or {}
        liked = client.collection(REACTIONS).document(f"{snap.id}__{uid}").get().exists
        posts.append({**p, "liked": liked})
    return {"posts": posts}


@router.post("/posts/{post_id}/like")
def toggle_like(post_id: str, claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    client = _client()
    post_ref = client.collection(POSTS).document(post_id)
    if not post_ref.get().exists:
        raise HTTPException(404, "Post not found.")
    react_ref = client.collection(REACTIONS).document(f"{post_id}__{uid}")
    if react_ref.get().exists:
        react_ref.delete()
        post_ref.update({"likes": firestore.Increment(-1)})
        liked = False
    else:
        react_ref.set({"postId": post_id, "uid": uid, "createdAt": _now()})
        post_ref.update({"likes": firestore.Increment(1)})
        liked = True
    likes = (post_ref.get().to_dict() or {}).get("likes", 0)
    return {"liked": liked, "likes": max(0, likes)}


@router.get("/posts/{post_id}/comments")
def list_comments(post_id: str, claims: dict = Depends(require_claims)) -> dict:
    client = _client()
    # Equality-only filter (no composite index needed); sort in Python.
    out = [
        snap.to_dict() or {}
        for snap in client.collection(COMMENTS).where(filter=FieldFilter("postId", "==", post_id)).limit(200).stream()
    ]
    out.sort(key=lambda c: c.get("createdAt", ""))
    return {"comments": out}


@router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, request: Request, claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    try:
        body = await request.json()
    except Exception:
        body = {}
    text = _clean(body.get("text") if isinstance(body, dict) else "", MAX_COMMENT)
    if not text:
        raise HTTPException(422, "A comment can't be empty.")
    client = _client()
    post_ref = client.collection(POSTS).document(post_id)
    if not post_ref.get().exists:
        raise HTTPException(404, "Post not found.")
    ref = client.collection(COMMENTS).document()
    comment = {
        "id": ref.id,
        "postId": post_id,
        "uid": uid,
        "authorName": _display_name(claims),
        "text": text,
        "createdAt": _now(),
    }
    ref.set(comment)
    post_ref.update({"comments": firestore.Increment(1)})
    return comment


# ── Challenges ──
def _ensure_challenges(client) -> None:
    """Seed the default challenges, and keep their content fresh (idempotent).

    New challenges are created with a zeroed participant counter. Existing ones get
    their *content* fields (blurbs, reward, art, theme, order) merged in without
    touching the live `participantCount`/`createdAt`, so editing copy here rolls out
    on the next read without a migration script.
    """
    col = client.collection(CHALLENGES)
    for c in DEFAULT_CHALLENGES:
        ref = col.document(c["id"])
        if ref.get().exists:
            ref.set(c, merge=True)  # refresh content only; counters untouched
        else:
            ref.set({**c, "participantCount": 0, "createdAt": _now()})


@router.get("/challenges")
def list_challenges(claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    client = _client()
    _ensure_challenges(client)
    out = []
    for snap in client.collection(CHALLENGES).stream():
        c = snap.to_dict() or {}
        member = client.collection(MEMBERS).document(f"{snap.id}__{uid}").get()
        out.append({
            **c,
            "joined": member.exists,
            "progress": (member.to_dict() or {}).get("progress", 0) if member.exists else 0,
        })
    out.sort(key=lambda c: (c.get("order", 99), c.get("title", "")))
    return {"challenges": out}


@router.post("/challenges/{challenge_id}/join")
def join_challenge(challenge_id: str, claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    client = _client()
    ch_ref = client.collection(CHALLENGES).document(challenge_id)
    if not ch_ref.get().exists:
        raise HTTPException(404, "Challenge not found.")
    member_ref = client.collection(MEMBERS).document(f"{challenge_id}__{uid}")
    if not member_ref.get().exists:
        member_ref.set({"challengeId": challenge_id, "uid": uid, "progress": 0, "joinedAt": _now()})
        ch_ref.update({"participantCount": firestore.Increment(1)})
    count = (ch_ref.get().to_dict() or {}).get("participantCount", 0)
    return {"joined": True, "participantCount": max(0, count)}


@router.post("/challenges/{challenge_id}/leave")
def leave_challenge(challenge_id: str, claims: dict = Depends(require_claims)) -> dict:
    """Leave a challenge: drop the membership and decrement the counter. Idempotent
    (leaving twice is a no-op). Progress is discarded; the user can rejoin later."""
    uid = claims["uid"]
    client = _client()
    ch_ref = client.collection(CHALLENGES).document(challenge_id)
    if not ch_ref.get().exists:
        raise HTTPException(404, "Challenge not found.")
    member_ref = client.collection(MEMBERS).document(f"{challenge_id}__{uid}")
    if member_ref.get().exists:
        member_ref.delete()
        ch_ref.update({"participantCount": firestore.Increment(-1)})
    count = (ch_ref.get().to_dict() or {}).get("participantCount", 0)
    return {"joined": False, "participantCount": max(0, count)}


# ── Weekly league ──
@router.post("/xp")
async def report_xp(request: Request, claims: dict = Depends(require_claims)) -> dict:
    """Add XP to the caller's weekly league tally. Called when the client awards
    XP (lesson complete). Server-authoritative per (week, uid)."""
    uid = claims["uid"]
    try:
        body = await request.json()
    except Exception:
        body = {}
    amount = body.get("amount") if isinstance(body, dict) else 0
    if not isinstance(amount, (int, float)) or amount <= 0 or amount > 10000:
        raise HTTPException(422, "Invalid XP amount.")
    week = _week_key()
    client = _client()
    ref = client.collection(LEADERBOARD).document(f"{week}__{uid}")
    ref.set(
        {"week": week, "uid": uid, "name": _display_name(claims), "xp": firestore.Increment(int(amount))},
        merge=True,
    )
    # The standings just changed; drop the cached top-100 for this week so the
    # next read reflects it (read-your-writes for the contributor).
    _leaderboard_cache.invalidate(week)
    return {"ok": True, "week": week}


def _week_rows(client, week: str) -> list[dict]:
    """The sorted top-100 standings for a week. Shared across users → cacheable.

    Equality-only filter (no composite index needed); rank in Python. Bounded at
    500/week for launch scale — revisit with an aggregation/index if it grows."""
    rows = [
        snap.to_dict() or {}
        for snap in client.collection(LEADERBOARD).where(filter=FieldFilter("week", "==", week)).limit(500).stream()
    ]
    rows.sort(key=lambda r: r.get("xp", 0), reverse=True)
    return rows[:100]


@router.get("/leaderboard")
def leaderboard(claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    week = _week_key()
    client = _client()
    rows = _leaderboard_cache.get_or_compute(week, lambda: _week_rows(client, week))

    me_xp = next((r.get("xp", 0) for r in rows if r.get("uid") == uid), None)
    if me_xp is None:
        snap = client.collection(LEADERBOARD).document(f"{week}__{uid}").get()
        me_xp = (snap.to_dict() or {}).get("xp", 0) if snap.exists else 0

    leaders = [
        {"rank": i + 1, "name": r.get("name", "Builder"), "xp": r.get("xp", 0), "isMe": r.get("uid") == uid}
        for i, r in enumerate(rows)
    ]
    my_rank = next((row["rank"] for row in leaders if row["isMe"]), None)
    return {"week": week, "leaders": leaders, "me": {"xp": me_xp, "rank": my_rank}}
