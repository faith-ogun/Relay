"""Community persistence (#63) — the social layer that fights churn.

Grounded in Duolingo's retention playbook (loss aversion + social pressure +
winnable weekly competition):
  - Feed: builders post wins/builds/questions; others react and comment. The
    posts + reactions are the user's *investment* (the Hook model's 4th step) —
    what makes leaving costly.
  - Challenges: shared, time-boxed goals on a real clock. A challenge is a
    SERIES; what a learner joins is an INSTANCE of it, with a start, an end, and
    standings that freeze when it closes. Enrolment outlives the instance, so a
    rollover is invisible. See the lifecycle section below and
    metadata/decisions/2026-08-26_live-challenge-lifecycle.md.
  - Weekly league: a leaderboard that RESETS every week (ISO week), so status is
    winnable and never a permanent hierarchy — asymmetric loss aversion each week.

Everything is server-authoritative and token-scoped: the author/uid come from the
verified token, never the client (same isolation contract as #44). Counters use
Firestore atomic increments. All reads/writes go through the Admin SDK.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

import obs
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
# The DURABLE series enrolment. It survives every rollover: this is what makes
# next week's entry appear without a second join.
MEMBERS = os.getenv("OHMLET_CHALLENGE_MEMBERS_COLLECTION", "community_challenge_members")
# One run of one series: {challengeId}__{periodKey}. Carries the window, the
# status, the participant count and, once closed, the frozen standings.
INSTANCES = os.getenv("OHMLET_CHALLENGE_INSTANCES_COLLECTION", "community_challenge_instances")
# One learner's run at one instance: progress now, rank once it closes.
ENTRIES = os.getenv("OHMLET_CHALLENGE_ENTRIES_COLLECTION", "community_challenge_entries")
# Every series a learner has ever joined, one document per pair, never deleted.
# _unenrol removes the enrolment because the participant count has to fall, but
# "Joined a challenge" is a thing that HAPPENED and cannot be un-happened. Without
# this, join, leave, join reported a fresh join every time and the achievement was
# farmable by tapping one button twice.
JOIN_HISTORY = os.getenv("OHMLET_CHALLENGE_HISTORY_COLLECTION", "community_challenge_history")
# One learner's settled awards, keyed by instance id. The idempotency ledger for
# every reward ever granted, and the learner's challenge history.
RECORDS = os.getenv("OHMLET_CHALLENGE_RECORDS_COLLECTION", "community_challenge_records")
LEADERBOARD = os.getenv("OHMLET_LEADERBOARD_COLLECTION", "community_leaderboard")
REPORTS = os.getenv("OHMLET_REPORTS_COLLECTION", "community_reports")
BLOCKS = os.getenv("OHMLET_BLOCKS_COLLECTION", "community_blocks")
REPORT_HIDE_THRESHOLD = int(os.getenv("OHMLET_REPORT_HIDE_THRESHOLD", "3"))

KINDS = {"build", "win", "question"}
MAX_TITLE = 140
MAX_BODY = 5000
MAX_COMMENT = 2000
FEED_LIMIT = 30

# ── Challenge templates ──
#
# A template is the SERIES. What a learner joins is an *instance* of it, with a
# real start, a real end, and standings that freeze when it closes. See
# metadata/decisions/2026-08-26_live-challenge-lifecycle.md.
#
# Each carries a short `desc` (shown on the card) and a richer `longDesc` (shown
# in the join dialog), plus a `goal`, an `art` key (selects the hero
# illustration on the client) and a `theme` colour. `order` fixes display order.
#
# The lifecycle fields are the ones that make it a challenge rather than a card:
#   cadence      how often a fresh instance opens (weekly / season / rolling)
#   metric       what counts toward the goal, machine readable
#   target       how much of it clears the goal
#   rewardXp     what completing actually pays, in XP
#   rewardBadge  the achievement id completing unlocks, where the reward is one

CADENCE_WEEKLY = "weekly"
CADENCE_SEASON = "season"
CADENCE_ROLLING = "rolling"
CADENCES = {CADENCE_WEEKLY, CADENCE_SEASON, CADENCE_ROLLING}

# Metric ids. Progress is derived from signals the server observes, never from a
# number the client sends: a client-owned progress field is a client that can win
# a leaderboard by typing into it.
METRIC_ACTIVE_DAYS = "active_days"
METRIC_LESSONS = "lessons_completed"
METRIC_BUILDS = "builds_completed"
METRIC_EXPLAINED_POSTS = "explained_posts"
METRIC_FREEFORM_BUILDS = "freeform_builds"
METRIC_SENSOR_TYPES = "sensor_types"
METRIC_SIM_FIXES = "sim_fixes"

DEFAULT_CHALLENGES = [
    {
        "id": "streak7",
        # Not "7-Day Streak" any more, and deliberately not a "streak" at all.
        # The goal is five days inside a seven day window, so a title claiming
        # seven would state a number the goal does not ask for, and "streak"
        # would promise consecutive days the metric no longer requires. The id
        # is unchanged: it keys live Firestore documents and the client's art.
        "title": "Five in Seven",
        "tagline": "Most days, not every day",
        "desc": "Log five active days of lessons or builds this week.",
        "longDesc": (
            "Skill comes from turning up often, not from keeping a perfect record. "
            "Complete at least one lesson or build on five separate days before this "
            "week's timer runs out. They do not have to be consecutive: two days off are "
            "built into the goal, so one busy day does not cost you the week."
        ),
        "reward": "+150 XP",
        "goal": "5 of 7 days",
        "durationDays": 7,
        "art": "streak",
        "theme": "red",
        "order": 1,
        "cadence": CADENCE_WEEKLY,
        "metric": METRIC_ACTIVE_DAYS,
        # Five, not seven. A day-counted goal is unjoinable for the last
        # target - 1 days of its own window, so a target equal to the window
        # length is joinable on one day of the week and inert on the other six.
        # Still the hardest weekly goal on the board, so it keeps the top weekly
        # reward. See metadata/decisions/2026-08-26_live-challenge-lifecycle.md.
        "target": 5,
        "rewardXp": 150,
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
        "cadence": CADENCE_WEEKLY,
        "metric": METRIC_FREEFORM_BUILDS,
        "target": 1,
        "rewardXp": 0,
        "rewardBadge": "nokit-champion",
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
        "cadence": CADENCE_WEEKLY,
        "metric": METRIC_EXPLAINED_POSTS,
        "target": 1,
        "rewardXp": 80,
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
        "cadence": CADENCE_WEEKLY,
        "metric": METRIC_SENSOR_TYPES,
        "target": 3,
        "rewardXp": 120,
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
        "cadence": CADENCE_WEEKLY,
        "metric": METRIC_SIM_FIXES,
        "target": 5,
        "rewardXp": 0,
        "rewardBadge": "debug-fixer",
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
        # Rolling, not weekly: a first-week goal measured against people who have
        # been here since March is not a first-week goal. The window starts when
        # the learner joins and there are no standings.
        "cadence": CADENCE_ROLLING,
        "metric": METRIC_LESSONS,
        "target": 3,
        "rewardXp": 60,
    },
    {
        "id": "streak30",
        # Same correction as the weekly one: it never measured a streak (the days
        # need not be consecutive) and it no longer asks for thirty. The id stays
        # because it keys live documents and the client's art.
        "title": "Twenty in a Season",
        "tagline": "The long game",
        "desc": "Log twenty active days of building across the season.",
        "longDesc": (
            "A week proves you can start. A season proves it stuck. Log twenty active days "
            "of lessons or builds before the season ends: they do not have to be consecutive, "
            "which is the point. This is the one that measures whether Ohmlet became a habit."
        ),
        "reward": "+400 XP",
        "goal": "20 active days",
        "durationDays": 90,
        # Its own scene, not the seven-day torch: a season card that draws the
        # weekly one reads as a duplicate of the challenge above it.
        "art": "streak30",
        "theme": "gold",
        "order": 7,
        # The season track. A weekly-only ladder has no memory, so nothing in it
        # can reward two months of consistency.
        "cadence": CADENCE_SEASON,
        "metric": METRIC_ACTIVE_DAYS,
        # Twenty, not thirty. The dead tail of a day-counted goal is exactly
        # target - 1 days, so thirty closed the season to new joiners for its
        # last month; twenty closes it for its last nineteen days and still asks
        # for a day and a half a week across a quarter. The reward is unchanged:
        # it is priced for staying enrolled a whole season, not per day.
        "target": 20,
        "rewardXp": 400,
        "rewardBadge": "season-streak",
    },
]

TEMPLATES: dict[str, dict] = {c["id"]: c for c in DEFAULT_CHALLENGES}

# Which observed signals feed which metric.
#
#   mode "days"  the entry unions a set of UTC date strings, so progress is the
#                number of distinct days inside the window. Idempotent by
#                construction, which matters because the events endpoint has no
#                idempotency key yet.
#   mode "count" the entry increments. A retried event batch double counts; see
#                the decision doc.
#   mode "set"   the entry unions distinct values read from `prop`.
#
# `events` names must exist in events.KNOWN_EVENTS or the signal never arrives.
# An empty set means the server credits this metric directly rather than from the
# event stream (explained posts are credited in create_post).
METRIC_SOURCES: dict[str, dict] = {
    METRIC_ACTIVE_DAYS: {
        "mode": "days",
        "events": {"lesson_complete", "build_complete", "streak_extended", "live_session_end"},
    },
    METRIC_LESSONS: {"mode": "count", "events": {"lesson_complete"}},
    METRIC_BUILDS: {"mode": "count", "events": {"build_complete"}},
    METRIC_EXPLAINED_POSTS: {"mode": "count", "events": set()},
    METRIC_FREEFORM_BUILDS: {"mode": "count", "events": {"freeform_build_complete"}},
    METRIC_SENSOR_TYPES: {"mode": "set", "events": {"sensor_verified"}, "prop": "sensor"},
    METRIC_SIM_FIXES: {"mode": "count", "events": {"sim_circuit_fixed"}},
}

# Every event name that can move any challenge, so a batch of events that touches
# none of them costs no Firestore work at all.
PROGRESS_EVENTS: set[str] = set().union(*(spec["events"] for spec in METRIC_SOURCES.values()))


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


def display_name(claims: dict) -> str:
    """The public alias other modules use, so nobody reaches for the private one."""
    return _display_name(claims)


def _clean(text: object, cap: int) -> str:
    if not isinstance(text, str):
        return ""
    return text.strip()[:cap]


def require_non_minor(claims: dict = Depends(require_claims)) -> dict:
    """Community WRITES are closed to a verified minor (#94): no posting, commenting,
    liking, joining challenges, or appearing on the public leaderboard. Reads stay open
    (the UI hides community for minors); moderation + reporting land with #97."""
    if claims.get("isMinor"):
        raise HTTPException(status_code=403, detail="Community is available on grown-up accounts.")
    return claims


def _blocked_set(client, uid: str) -> set[str]:
    """The set of uids the caller has blocked; their content is filtered from feeds."""
    try:
        return {
            (s.to_dict() or {}).get("targetUid")
            for s in client.collection(BLOCKS).where(filter=FieldFilter("uid", "==", uid)).limit(500).stream()
        } - {None}
    except Exception as exc:
        logger.warning("blocklist read failed for %s: %s", uid, exc)
        return set()


# ── Feed ──
@router.post("/posts")
async def create_post(request: Request, claims: dict = Depends(require_non_minor)) -> dict:
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
    # Teach It Back counts a real explanation, not "nice build". Credited here
    # rather than from an event because the server can see the post itself, which
    # makes it the one progress signal on that challenge a client cannot forge.
    if kind == "build" and len(text) >= MIN_EXPLAINED_BODY:
        credit_metric(uid, METRIC_EXPLAINED_POSTS, name=doc["authorName"])
    return {**doc, "liked": False}


@router.get("/posts")
def list_posts(claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    client = _client()
    blocked = _blocked_set(client, uid)
    posts = []
    for snap in (
        client.collection(POSTS).order_by("createdAt", direction=firestore.Query.DESCENDING).limit(FEED_LIMIT).stream()
    ):
        p = snap.to_dict() or {}
        if p.get("hidden") or p.get("uid") in blocked:  # auto-hidden (reported) or a blocked author
            continue
        liked = client.collection(REACTIONS).document(f"{snap.id}__{uid}").get().exists
        posts.append({**p, "liked": liked})
    return {"posts": posts}


@router.post("/posts/{post_id}/like")
def toggle_like(post_id: str, claims: dict = Depends(require_non_minor)) -> dict:
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


# ── Moderation (#97): report + block. Reads stay open; the UI hides community for
# minors (#94). Satisfies DSA notice-and-action and the Apple 1.2 / Google UGC bar. ──
@router.post("/posts/{post_id}/report")
def report_post(post_id: str, claims: dict = Depends(require_claims)) -> dict:
    """Report a post. One report per user per post; the post auto-hides once it passes
    the threshold, pending review. The report row is the durable audit trail."""
    uid = claims["uid"]
    client = _client()
    post_ref = client.collection(POSTS).document(post_id)
    if not post_ref.get().exists:
        raise HTTPException(404, "Post not found.")
    report_ref = client.collection(REPORTS).document(f"{post_id}__{uid}")

    @firestore.transactional
    def _apply(transaction) -> int | None:
        """Record the report and decide hiding from the same serialized read.

        Previously the count came from a read AFTER the write, outside any
        transaction. Two reports landing together both saw the pre-threshold
        value, so neither set `hidden` even though the total had passed it: a
        post could clear the reporting threshold and stay visible. Deciding
        inside the transaction makes the threshold hold under concurrency.
        """
        snap = post_ref.get(transaction=transaction)
        if not snap.exists:
            return None
        if report_ref.get(transaction=transaction).exists:
            return -1
        count = int((snap.to_dict() or {}).get("reports", 0)) + 1
        transaction.set(report_ref, {"postId": post_id, "reporterUid": uid, "createdAt": _now()})
        update: dict = {"reports": count}
        if count >= REPORT_HIDE_THRESHOLD:
            update["hidden"] = True
        transaction.update(post_ref, update)
        return count

    reports = _apply(client.transaction())
    if reports is None:
        raise HTTPException(404, "Post not found.")
    if reports < 0:
        return {"status": "already_reported"}
    if reports >= REPORT_HIDE_THRESHOLD:
        logger.warning("post auto-hidden after %d reports: %s", reports, post_id)
    logger.info("post reported: %s by %s (count=%d)", post_id, uid, reports)
    return {"status": "reported"}


@router.post("/block")
async def block_user(request: Request, claims: dict = Depends(require_claims)) -> dict:
    """Hide all of another user's content from the caller."""
    uid = claims["uid"]
    try:
        body = await request.json()
    except Exception:
        body = {}
    target = ((body.get("targetUid") if isinstance(body, dict) else "") or "").strip()
    if not target or target == uid:
        raise HTTPException(422, "Nothing to block.")
    _client().collection(BLOCKS).document(f"{uid}__{target}").set(
        {"uid": uid, "targetUid": target, "createdAt": _now()}
    )
    logger.info("user %s blocked %s", uid, target)
    return {"status": "blocked", "targetUid": target}


@router.post("/unblock")
async def unblock_user(request: Request, claims: dict = Depends(require_claims)) -> dict:
    uid = claims["uid"]
    try:
        body = await request.json()
    except Exception:
        body = {}
    target = ((body.get("targetUid") if isinstance(body, dict) else "") or "").strip()
    if target:
        _client().collection(BLOCKS).document(f"{uid}__{target}").delete()
    return {"status": "unblocked", "targetUid": target}


@router.get("/posts/{post_id}/comments")
def list_comments(post_id: str, claims: dict = Depends(require_claims)) -> dict:
    client = _client()
    blocked = _blocked_set(client, claims["uid"])
    # Equality-only filter (no composite index needed); sort in Python.
    out = []
    for snap in client.collection(COMMENTS).where(filter=FieldFilter("postId", "==", post_id)).limit(200).stream():
        c = snap.to_dict() or {}
        if c.get("uid") in blocked:
            continue
        out.append(c)
    out.sort(key=lambda c: c.get("createdAt", ""))
    return {"comments": out}


@router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, request: Request, claims: dict = Depends(require_non_minor)) -> dict:
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


# ── Challenge lifecycle ──
#
# The three questions this section answers, and the mechanism for each:
#
#   Does it recur?     Yes. An instance id is {challengeId}__{periodKey}, and the
#                      period key is derived from the UTC clock. A new key means a
#                      new instance, created on first read.
#   Does it end?       Yes. open -> closing -> closed. Standings are computed once
#                      and frozen onto the instance.
#   What survives?     Enrolment (community_challenge_members) and the settled
#                      record (community_challenge_records), neither of which is
#                      touched by rollover.
#
# Rollover is LAZY, on read, not scheduled. Cloud Run scales to zero, so an
# in-process timer at the week boundary fires on nobody or on three instances at
# once. Doing the work on the path that needs the result means an instance cannot
# be observed stale, because observing it is what rolls it.
#
# Full reasoning: metadata/decisions/2026-08-26_live-challenge-lifecycle.md

STATUS_OPEN = "open"
STATUS_CLOSING = "closing"
STATUS_CLOSED = "closed"

# How long a close claim is honoured before another reader may retake it. A
# process that dies mid-close would otherwise leave the instance at "closing"
# forever. Retaking is safe because the close is deterministic: it recomputes the
# same standings and writes the same ranks.
CLOSE_LEASE_SECONDS = float(os.getenv("OHMLET_CHALLENGE_CLOSE_LEASE_SEC", "120"))

# Bounds. Standings are ranked in Python from an equality-only query (no composite
# index), in the same style as the weekly league.
MAX_ENTRY_SCAN = int(os.getenv("OHMLET_CHALLENGE_ENTRY_SCAN", "500"))
MAX_STANDINGS = 100
MAX_ENROLMENTS = 50
MAX_DAY_KEYS = 120
MAX_SET_VALUES = 40
# How many closes may be owed at once before the oldest is abandoned. A close is
# normally owed for milliseconds; a run of them means closing has been failing
# for weeks, which the log will already be shouting about.
MAX_PENDING_CLOSES = 24

# Podium bonus for a ranked instance, paid for the ladder rather than the goal:
# getting furthest is what the ladder measures, so it pays even in a week nobody
# clears the target. It requires progress above zero, so the sole participant of
# an empty week does not collect for existing.
PODIUM_BONUS_XP = (40, 25, 15)

# A post counts as "explained" at this length. Short enough that a genuine
# walkthrough clears it, long enough that "nice build" does not.
MIN_EXPLAINED_BODY = int(os.getenv("OHMLET_EXPLAINED_POST_CHARS", "180"))

# The open instance document is identical for every viewer and is read on every
# Community open, so it is cached briefly per instance id, as the league's top
# 100 already is. The key contains the period key, so a rollover is a cache MISS
# by construction and can never be served stale across a boundary. Joining and
# leaving invalidate it so the participant count is read-your-writes.
_INSTANCE_TTL = float(os.getenv("OHMLET_CHALLENGE_INSTANCE_CACHE_TTL", "15"))
_instance_cache = TTLCache(ttl=_INSTANCE_TTL)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _parse_iso(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _day_key(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def _week_period(now: datetime) -> tuple[str, datetime, datetime]:
    """The ISO week containing `now`, anchored to Monday 00:00 UTC.

    UTC and not the learner's local week because the standings are shared: if the
    boundary moved with the viewer, two people on one leaderboard would be racing
    different deadlines. The client renders the remaining time as a countdown, so
    the anchor is never something a learner has to know.
    """
    day = now.astimezone(timezone.utc)
    start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc) - timedelta(days=day.weekday())
    year, week, _ = start.isocalendar()
    return f"{year}-W{week:02d}", start, start + timedelta(days=7)


def _season_period(now: datetime) -> tuple[str, datetime, datetime]:
    """The calendar quarter containing `now`, anchored to UTC."""
    day = now.astimezone(timezone.utc)
    quarter = (day.month - 1) // 3 + 1
    start = datetime(day.year, 3 * (quarter - 1) + 1, 1, tzinfo=timezone.utc)
    end = (
        datetime(day.year + 1, 1, 1, tzinfo=timezone.utc)
        if quarter == 4
        else datetime(day.year, 3 * quarter + 1, 1, tzinfo=timezone.utc)
    )
    return f"{day.year}-S{quarter}", start, end


def _period_for(cadence: str, now: datetime) -> tuple[str, datetime, datetime]:
    if cadence == CADENCE_SEASON:
        return _season_period(now)
    return _week_period(now)


def _instance_id(challenge_id: str, period_key: str) -> str:
    return f"{challenge_id}__{period_key}"


def _entry_id(instance_id: str, uid: str) -> str:
    return f"{instance_id}__{uid}"


def _is_ranked(template: dict) -> bool:
    """Rolling challenges have no shared window, so nothing to rank against."""
    return template.get("cadence") != CADENCE_ROLLING


def _target(template: dict) -> int:
    return max(1, int(template.get("target") or 1))


def _instance_target(instance: dict, template: dict) -> int:
    """The one bar every entry in this instance is judged against.

    Read from the instance, which froze it when the round opened, NOT from the
    template on each join. A target retuned mid-round would otherwise hand the
    people who joined before the deploy and the people who joined after it two
    different bars inside one shared ranking: the earlier joiner can finish with
    more days done, ranked above, and still be told they missed the goal while
    the later one collects the reward. That is the exact failure a pro-rated
    target was rejected for, arriving by a different door.

    Falls back to the template only for an instance written before instances
    carried a target at all.
    """
    frozen = int(instance.get("target") or 0)
    return frozen if frozen > 0 else _target(template)


# ── Instances: create if absent, advance the pointer, close exactly once ──
def _ensure_instance(client, template: dict, period_key: str, start: datetime, end: datetime) -> dict:
    """The instance for this period, created if it does not exist yet.

    The document id is derived from the clock, so every concurrent caller aims at
    the same id and the transaction writes only when it is absent. Two racing
    readers therefore produce one instance, not two.
    """
    ref = client.collection(INSTANCES).document(_instance_id(template["id"], period_key))
    existing = ref.get()
    if existing.exists:
        # Steady state is one read. The transaction is only for the moment an
        # instance is born, which is once per period per series.
        return existing.to_dict() or {}

    @firestore.transactional
    def _create(transaction) -> dict:
        snap = ref.get(transaction=transaction)
        if snap.exists:
            return snap.to_dict() or {}
        doc = {
            "id": ref.id,
            "challengeId": template["id"],
            "periodKey": period_key,
            "cadence": template.get("cadence", CADENCE_WEEKLY),
            "metric": template.get("metric", ""),
            "target": _target(template),
            "startsAt": _iso(start),
            "endsAt": _iso(end),
            "status": STATUS_OPEN,
            "participantCount": 0,
            "createdAt": _now(),
        }
        transaction.set(ref, doc)
        return doc

    return _create(client.transaction())


def _is_behind(period_key: str, current: object) -> bool:
    """Whether `period_key` names an EARLIER period than the pointer already holds.

    Only meaningful between two keys of the same cadence: "2026-S4" and
    "2026-W35" are not on the same scale, so a series whose cadence was retuned
    between deploys must still be allowed to move to its new kind of key.
    """
    if not isinstance(current, str) or not current:
        return False
    if ("-W" in current) != ("-W" in period_key):
        return False
    return current > period_key


def _pending_closes(data: dict) -> list[str]:
    """The outstanding to-do list, tolerating the single-key shape written before.

    `pendingClose` used to hold one period key. It holds a LIST because more than
    one close can be outstanding at once: a close that fails for a whole period
    is still owed when the next boundary arrives, and overwriting it there loses
    that period's standings permanently.
    """
    raw = data.get("pendingClose")
    if isinstance(raw, str) and raw:
        return [raw]
    if isinstance(raw, list):
        seen: list[str] = []
        for key in raw:
            if isinstance(key, str) and key and key not in seen:
                seen.append(key)
        return seen
    return []


def _advance_pointer(client, challenge_id: str, period_key: str) -> list[str]:
    """Move the series pointer to `period_key`. Returns every close still owed.

    Exactly one caller can win this transaction, and only that caller adds the
    outgoing key to `pendingClose`, a durable to-do list: if the winner dies
    before closing, the pointer has already moved and no later reader would
    otherwise notice there was work outstanding. Every later reader is handed the
    same list until each key is closed, and the list is APPENDED to rather than
    replaced, so a close owed from an earlier period survives the next boundary.

    The pointer only ever moves forward. Period keys sort lexicographically in
    time order ("2026-W09" < "2026-W10", "2026-S1" < "2026-S2"), so a reader on
    an instance whose clock is a second behind cannot drag the series back into a
    week that has already been closed.
    """
    ref = client.collection(CHALLENGES).document(challenge_id)
    snapshot = ref.get()
    if snapshot.exists:
        seen = snapshot.to_dict() or {}
        if seen.get("currentPeriodKey") == period_key and not _pending_closes(seen):
            # Nothing to move and nothing left behind: no transaction needed.
            return []

    @firestore.transactional
    def _advance(transaction) -> list[str]:
        snap = ref.get(transaction=transaction)
        data = (snap.to_dict() or {}) if snap.exists else {}
        current = data.get("currentPeriodKey")
        pending = _pending_closes(data)
        if current == period_key or _is_behind(period_key, current):
            # Already current, or this reader's clock is behind another one's.
            # Either way the pointer stays put; hand back whatever is still owed.
            return pending
        if isinstance(current, str) and current and current not in pending:
            pending = [*pending, current][-MAX_PENDING_CLOSES:]
        transaction.set(
            ref,
            {
                "currentPeriodKey": period_key,
                "pendingClose": pending,
                "rolledAt": _now(),
            },
            merge=True,
        )
        return pending

    return _advance(client.transaction())


def _clear_pending(client, challenge_id: str, period_key: str) -> None:
    """Take one period off the to-do list, leaving any other outstanding close."""
    ref = client.collection(CHALLENGES).document(challenge_id)

    @firestore.transactional
    def _clear(transaction) -> None:
        snap = ref.get(transaction=transaction)
        if not snap.exists:
            return
        pending = _pending_closes(snap.to_dict() or {})
        if period_key not in pending:
            return
        transaction.set(ref, {"pendingClose": [k for k in pending if k != period_key]}, merge=True)

    try:
        _clear(client.transaction())
    except Exception as exc:
        logger.warning("could not clear pendingClose for %s/%s: %s", challenge_id, period_key, exc)


def _entries_for_instance(client, instance_id: str) -> list[dict]:
    rows = []
    for snap in (
        client.collection(ENTRIES)
        .where(filter=FieldFilter("instanceId", "==", instance_id))
        .limit(MAX_ENTRY_SCAN)
        .stream()
    ):
        row = snap.to_dict() or {}
        row.setdefault("id", snap.id)
        rows.append(row)
    return rows


def _rank_entries(entries: list[dict]) -> list[dict]:
    """Strict ordering, never a shared rank.

    progress desc, then whoever cleared the goal first, then whoever committed
    first, then uid. The last key looks like a detail and is load bearing: it
    makes the close deterministic, which is what makes retrying a close safe.
    """
    far = "9999"

    def key(row: dict) -> tuple:
        return (
            -int(row.get("progress") or 0),
            str(row.get("completedAt") or far),
            str(row.get("joinedAt") or far),
            str(row.get("uid") or ""),
        )

    return sorted(entries, key=key)


def _close_instance(client, challenge_id: str, period_key: str, now: datetime | None = None) -> dict | None:
    """Close an instance once: freeze the standings, stamp every entry's rank.

    Returns the closed instance, or None if there was nothing to close. Safe to
    call from anywhere and from several callers at once: the transition to
    `closing` is transactional, so one caller does the work, and the work itself
    is deterministic, so a retry after a crash writes identical values rather than
    awarding anything twice.

    Rewards are deliberately NOT granted here. The close writes ranks; each
    learner settles their own record on their next read (see settle_for). That
    keeps a close O(1) writes per participant instead of a fan out of grants the
    closer would have to complete or retry.
    """
    now = now or _utcnow()
    ref = client.collection(INSTANCES).document(_instance_id(challenge_id, period_key))

    @firestore.transactional
    def _claim(transaction) -> str:
        snap = ref.get(transaction=transaction)
        if not snap.exists:
            return "missing"
        data = snap.to_dict() or {}
        status = data.get("status")
        if status == STATUS_CLOSED:
            return "already"
        ends = _parse_iso(data.get("endsAt"))
        if ends and now < ends:
            return "running"
        if status == STATUS_CLOSING:
            claimed = _parse_iso(data.get("closeClaimedAt"))
            if claimed and (now - claimed).total_seconds() < CLOSE_LEASE_SECONDS:
                return "busy"
        transaction.set(ref, {"status": STATUS_CLOSING, "closeClaimedAt": _iso(now)}, merge=True)
        return "claimed"

    outcome = _claim(client.transaction())
    if outcome != "claimed":
        if outcome in ("already", "missing"):
            # Nothing to do here, and nothing anyone else can do either: an
            # instance that is closed, or that never existed, is not work. Take
            # it off the to-do list or every read of this series retries it for
            # the rest of the product's life.
            _clear_pending(client, challenge_id, period_key)
        return None

    entries = _rank_entries(_entries_for_instance(client, ref.id))
    target = 0
    standings: list[dict] = []
    completed_count = 0

    for index, row in enumerate(entries):
        rank = index + 1
        progress = int(row.get("progress") or 0)
        target = max(target, int(row.get("target") or 0))
        done = bool(row.get("completed"))
        if done:
            completed_count += 1
        entry_ref = client.collection(ENTRIES).document(str(row.get("id")))
        try:
            entry_ref.set(
                {
                    "rank": rank,
                    "finalProgress": progress,
                    "completed": done,
                    "closedAt": _iso(now),
                },
                merge=True,
            )
        except Exception as exc:
            # Left at "closing"; the lease lets a later reader redo the whole
            # close, which recomputes the same values.
            logger.error("could not stamp entry %s on close: %s", row.get("id"), exc)
            return None
        if rank <= MAX_STANDINGS:
            standings.append(
                {
                    "rank": rank,
                    "uid": row.get("uid"),
                    "name": row.get("name") or "Builder",
                    "progress": progress,
                    "completed": done,
                }
            )

    winner = next((row for row in standings if row["completed"]), None)
    closed = {
        "status": STATUS_CLOSED,
        "closedAt": _iso(now),
        "closeClaimedAt": None,
        "standings": standings,
        "participantCount": len(entries),
        "completedCount": completed_count,
        "target": target,
        # No winner when nobody cleared the goal. Naming one anyway would be the
        # fake-but-pretty data the design rules forbid.
        "winner": {"uid": winner["uid"], "name": winner["name"]} if winner else None,
    }
    ref.set(closed, merge=True)
    _clear_pending(client, challenge_id, period_key)
    logger.info(
        "challenge instance closed: %s participants=%d completed=%d winner=%s",
        ref.id, len(entries), completed_count, (winner or {}).get("name"),
    )
    obs.audit(
        "community.challenge_closed",
        challengeId=challenge_id,
        periodKey=period_key,
        participants=len(entries),
        completed=completed_count,
    )
    return {**closed, "id": ref.id, "challengeId": challenge_id, "periodKey": period_key}


def _current_instance(client, template: dict, now: datetime) -> dict:
    """The open instance for this series right now, rolling over if the clock says so."""
    period_key, start, end = _period_for(template.get("cadence", CADENCE_WEEKLY), now)
    instance_id = _instance_id(template["id"], period_key)
    return _instance_cache.get_or_compute(
        instance_id, lambda: _resolve_instance(client, template, period_key, start, end, now)
    )


def _resolve_instance(
    client, template: dict, period_key: str, start: datetime, end: datetime, now: datetime
) -> dict:
    challenge_id = template["id"]
    for outgoing in _advance_pointer(client, challenge_id, period_key):
        if outgoing == period_key:
            # The period that is running is not work. Only a pointer written
            # before this file grew a monotonic guard can name it; drop it rather
            # than step over it forever.
            _clear_pending(client, challenge_id, outgoing)
            continue
        try:
            _close_instance(client, challenge_id, outgoing, now)
        except Exception as exc:
            # A failed close must not take the current instance down with it, nor
            # stop the other closes owed: the pendingClose list means a later
            # reader picks the work back up.
            logger.error("close of %s/%s failed: %s", challenge_id, outgoing, exc)

    instance = _ensure_instance(client, template, period_key, start, end)

    # Belt and braces for clock skew or a pointer that moved without a close: an
    # instance found open past its own end is closed here too.
    if instance.get("status") == STATUS_OPEN and (_parse_iso(instance.get("endsAt")) or end) <= now:
        closed = _close_instance(client, challenge_id, period_key, now)
        if closed:
            instance = {**instance, **closed}
    return instance


# ── Entries: the learner's run at one instance ──
def _ensure_entry(
    client, template: dict, instance: dict, uid: str, name: str, skip_period: object = None
) -> dict | None:
    """Create the caller's entry in this instance if the enrolment says they belong.

    Returns the entry, or None when the learner is enrolled for a LATER instance
    (a late join into a day-counting goal that can no longer be reached).
    `skip_period` is the period key the enrolment was booked OUT of: without it
    the very next read would quietly enter them into the race the join endpoint
    had just told them they were not in.
    """
    if isinstance(skip_period, str) and skip_period and skip_period == instance.get("periodKey"):
        return None

    entry_ref = client.collection(ENTRIES).document(_entry_id(instance["id"], uid))
    existing = entry_ref.get()
    if existing.exists:
        # Steady state is one read: the transaction below is for the moment an
        # entry is born, which is once per learner per period.
        return existing.to_dict() or {}

    inst_ref = client.collection(INSTANCES).document(instance["id"])
    now_iso = _now()

    @firestore.transactional
    def _create(transaction) -> dict | None:
        snap = entry_ref.get(transaction=transaction)
        if snap.exists:
            return snap.to_dict() or {}
        inst_snap = inst_ref.get(transaction=transaction)
        if not inst_snap.exists:
            return None
        inst = inst_snap.to_dict() or {}
        if inst.get("status") != STATUS_OPEN:
            return None
        doc = {
            "id": entry_ref.id,
            "instanceId": instance["id"],
            "challengeId": template["id"],
            "periodKey": instance["periodKey"],
            "uid": uid,
            "name": name,
            "progress": 0,
            # The instance's bar, read inside the transaction, so that everyone
            # in one round is racing one number. See `_instance_target`.
            "target": _instance_target(inst, template),
            "metric": template.get("metric", ""),
            "completed": False,
            "ranked": _is_ranked(template),
            "startsAt": inst.get("startsAt"),
            "endsAt": inst.get("endsAt"),
            "joinedAt": now_iso,
        }
        transaction.set(entry_ref, doc)
        transaction.set(
            inst_ref, {"participantCount": int(inst.get("participantCount") or 0) + 1}, merge=True
        )
        return doc

    entry = _create(client.transaction())
    if entry and entry.get("joinedAt") == now_iso:
        # A participant was just added, so the cached instance is one short. Drop
        # it here rather than at each call site: an entry materialised by a
        # rollover would otherwise render a card claiming nobody had joined.
        _instance_cache.invalidate(instance["id"])
    return entry


def _rolling_window(template: dict, now: datetime) -> tuple[str, datetime, datetime]:
    days = max(1, int(template.get("durationDays") or 7))
    return f"r{_day_key(now)}", now, now + timedelta(days=days)


def _rolling_entry_doc(template: dict, uid: str, name: str, period_key: str, start: datetime, end: datetime) -> dict:
    """The shape of a rolling entry, in one place: it is written from two paths."""
    instance_id = _instance_id(template["id"], period_key)
    return {
        "id": _entry_id(instance_id, uid),
        "instanceId": instance_id,
        "challengeId": template["id"],
        "periodKey": period_key,
        "uid": uid,
        "name": name,
        "progress": 0,
        "target": _target(template),
        "metric": template.get("metric", ""),
        "completed": False,
        "ranked": False,
        "startsAt": _iso(start),
        "endsAt": _iso(end),
        "joinedAt": _now(),
    }


def _ensure_rolling_entry(
    client, template: dict, enrolment: dict, uid: str, name: str, now: datetime
) -> dict | None:
    """A rolling challenge has no shared instance: the entry carries its own window.

    An enrolment with no window is not a broken row to skip past. It is what the
    membership collection looked like before instances existed, and there are
    live ones: skipping them leaves a learner joined to First Light with a bar
    that can never move and no way to notice. The window is opened now instead,
    and the enrolment is upgraded in place.
    """
    period_key = enrolment.get("periodKey")
    if isinstance(period_key, str) and period_key:
        entry_ref = client.collection(ENTRIES).document(
            _entry_id(_instance_id(template["id"], period_key), uid)
        )
        snap = entry_ref.get()
        if snap.exists:
            return snap.to_dict() or {}

    period_key, start, end = _rolling_window(template, now)
    doc = _rolling_entry_doc(template, uid, name, period_key, start, end)
    try:
        client.collection(ENTRIES).document(doc["id"]).set(doc)
        client.collection(MEMBERS).document(f"{template['id']}__{uid}").set(
            {"periodKey": period_key, "cadence": CADENCE_ROLLING, "enrolledFor": "current"},
            merge=True,
        )
    except Exception as exc:
        logger.warning("could not open a rolling window for %s/%s: %s", uid, template["id"], exc)
        return None
    return doc


def _finalise_rolling_entry(client, entry: dict, now: datetime) -> dict:
    """Close a rolling entry whose personal window has run out. Unranked by design."""
    if entry.get("closedAt"):
        return entry
    ends = _parse_iso(entry.get("endsAt"))
    if not ends or now < ends:
        return entry
    closed = {
        "closedAt": _iso(now),
        "finalProgress": int(entry.get("progress") or 0),
        "completed": bool(entry.get("completed")),
        "rank": None,
    }
    try:
        client.collection(ENTRIES).document(str(entry.get("id"))).set(closed, merge=True)
    except Exception as exc:
        logger.warning("could not finalise rolling entry %s: %s", entry.get("id"), exc)
        return entry
    return {**entry, **closed}


# ── Progress ──
def _apply_progress(
    client,
    entry_id: str,
    mode: str,
    delta: int,
    day_keys: set[str],
    values: set[str],
    now: datetime,
) -> None:
    """Move one entry's progress, inside a transaction, within its own window.

    Progress is capped at the target: past the goal the ordering that matters is
    who got there first, which is what the tie rule already encodes.
    """
    ref = client.collection(ENTRIES).document(entry_id)

    @firestore.transactional
    def _bump(transaction) -> None:
        snap = ref.get(transaction=transaction)
        if not snap.exists:
            return
        data = snap.to_dict() or {}
        if data.get("closedAt"):
            return
        start = _parse_iso(data.get("startsAt"))
        end = _parse_iso(data.get("endsAt"))
        if (start and now < start) or (end and now >= end):
            return

        target = max(1, int(data.get("target") or 1))
        updates: dict[str, Any] = {}
        if mode == "days":
            days = {d for d in (data.get("days") or []) if isinstance(d, str)} | day_keys
            trimmed = sorted(days)[-MAX_DAY_KEYS:]
            updates["days"] = trimmed
            progress = len(trimmed)
        elif mode == "set":
            seen = {v for v in (data.get("values") or []) if isinstance(v, str)} | values
            trimmed_values = sorted(seen)[:MAX_SET_VALUES]
            updates["values"] = trimmed_values
            progress = len(trimmed_values)
        else:
            progress = int(data.get("progress") or 0) + max(0, delta)

        progress = max(0, min(progress, target))
        if progress == int(data.get("progress") or 0) and not updates:
            return
        updates["progress"] = progress
        if progress >= target and not data.get("completed"):
            updates["completed"] = True
            updates["completedAt"] = _iso(now)
        transaction.set(ref, updates, merge=True)

    _bump(client.transaction())


def _enrolments_for(client, uid: str) -> list[dict]:
    rows = []
    for snap in (
        client.collection(MEMBERS).where(filter=FieldFilter("uid", "==", uid)).limit(MAX_ENROLMENTS).stream()
    ):
        row = snap.to_dict() or {}
        row.setdefault("id", snap.id)
        rows.append(row)
    return rows


def _live_entries_for(client, uid: str, name: str, now: datetime) -> list[tuple[dict, dict]]:
    """(template, entry) for every instance the learner is currently running.

    Materialises the entry if the enrolment has survived a rollover but the
    learner has not opened Community since. Progress must count from the moment
    the instance opened, not from the next time they happen to look at it.
    """
    out: list[tuple[dict, dict]] = []
    for enrolment in _enrolments_for(client, uid):
        if enrolment.get("active") is False:
            continue
        template = TEMPLATES.get(str(enrolment.get("challengeId") or ""))
        if not template:
            continue
        try:
            if template.get("cadence") == CADENCE_ROLLING:
                entry = _ensure_rolling_entry(client, template, enrolment, uid, name, now)
            else:
                instance = _current_instance(client, template, now)
                entry = _ensure_entry(
                    client, template, instance, uid, name, enrolment.get("skipPeriodKey")
                )
        except Exception as exc:
            logger.warning("could not resolve entry for %s/%s: %s", uid, enrolment.get("challengeId"), exc)
            continue
        if entry and not entry.get("closedAt"):
            out.append((template, entry))
    return out


def credit_metric(uid: str, metric: str, *, amount: int = 1, value: str = "", name: str = "") -> None:
    """Credit one metric toward every open entry that counts it.

    Called from the event ingest and from the handlers that observe something
    directly. Best effort by design: a failure here must never fail the action
    that produced the signal.
    """
    spec = METRIC_SOURCES.get(metric)
    if not spec:
        return
    mode = spec["mode"]
    cleaned = value.strip().lower()[:40]
    _credit(
        uid,
        {metric: max(1, amount)} if mode == "count" else {},
        {metric} if mode == "days" else set(),
        {metric: {cleaned}} if mode == "set" and cleaned else {},
        name,
    )


def _credit(
    uid: str,
    counts: dict[str, int],
    day_metrics: set[str],
    values: dict[str, set[str]],
    name: str = "",
) -> None:
    if not counts and not day_metrics and not values:
        return
    try:
        client = _client()
        now = _utcnow()
        today = {_day_key(now)}
        for template, entry in _live_entries_for(client, uid, name, now):
            metric = template.get("metric", "")
            spec = METRIC_SOURCES.get(metric)
            if not spec:
                continue
            mode = spec["mode"]
            if mode == "days":
                if metric not in day_metrics:
                    continue
                _apply_progress(client, str(entry.get("id")), mode, 0, today, set(), now)
            elif mode == "set":
                got = values.get(metric)
                if not got:
                    continue
                _apply_progress(client, str(entry.get("id")), mode, 0, set(), got, now)
            else:
                delta = int(counts.get(metric) or 0)
                if delta <= 0:
                    continue
                _apply_progress(client, str(entry.get("id")), mode, delta, set(), set(), now)
    except Exception as exc:
        logger.warning("challenge progress credit failed for %s: %s", uid, exc)


def record_events(uid: str, observed: list[tuple[str, dict]], name: str = "") -> None:
    """Turn a batch of accepted analytics events into challenge progress.

    This is the only forgery-resistant source available: the events endpoint
    already verifies the uid from the token and validates every name against a
    closed catalogue. A batch that touches no metric costs no Firestore work.
    """
    if not observed:
        return
    counts: dict[str, int] = {}
    day_metrics: set[str] = set()
    values: dict[str, set[str]] = {}
    for event_name, props in observed:
        if event_name not in PROGRESS_EVENTS:
            continue
        for metric, spec in METRIC_SOURCES.items():
            if event_name not in spec["events"]:
                continue
            if spec["mode"] == "days":
                day_metrics.add(metric)
            elif spec["mode"] == "set":
                raw = props.get(spec.get("prop", "")) if isinstance(props, dict) else None
                if isinstance(raw, str) and raw.strip():
                    values.setdefault(metric, set()).add(raw.strip().lower()[:40])
            else:
                counts[metric] = counts.get(metric, 0) + 1
    _credit(uid, counts, day_metrics, values, name)


# ── Settlement: the learner's own record, granted once ──
def _award_for(template: dict, entry: dict) -> dict:
    """What one finished entry pays. Deterministic from the frozen entry."""
    rank = entry.get("rank")
    completed = bool(entry.get("completed"))
    xp = int(template.get("rewardXp") or 0) if completed else 0
    badge = template.get("rewardBadge") if completed else None
    bonus = 0
    if isinstance(rank, int) and 1 <= rank <= len(PODIUM_BONUS_XP) and int(entry.get("finalProgress") or entry.get("progress") or 0) > 0:
        bonus = PODIUM_BONUS_XP[rank - 1]
    return {
        "instanceId": entry.get("instanceId"),
        "challengeId": template["id"],
        "title": template.get("title", ""),
        "periodKey": entry.get("periodKey"),
        "rank": rank,
        "progress": int(entry.get("finalProgress") or entry.get("progress") or 0),
        "target": int(entry.get("target") or _target(template)),
        "completed": completed,
        "xp": xp + bonus,
        "podiumBonus": bonus,
        "badge": badge,
    }


def _finished_entries(client, uid: str, now: datetime) -> list[tuple[dict, dict]]:
    """Every entry of the caller's that has closed, ranked or rolling."""
    out: list[tuple[dict, dict]] = []
    for snap in (
        client.collection(ENTRIES).where(filter=FieldFilter("uid", "==", uid)).limit(MAX_ENTRY_SCAN).stream()
    ):
        entry = snap.to_dict() or {}
        entry.setdefault("id", snap.id)
        template = TEMPLATES.get(str(entry.get("challengeId") or ""))
        if not template:
            continue
        if not entry.get("closedAt") and template.get("cadence") == CADENCE_ROLLING:
            entry = _finalise_rolling_entry(client, entry, now)
        if entry.get("closedAt"):
            out.append((template, entry))
    return out


def settle_for(uid: str) -> dict:
    """Grant every finished challenge the caller has not been paid for yet.

    The same shape as the checkpoint grant, for the same reasons: settling
    everything outstanding in one call is naturally idempotent (a second call
    finds nothing left), it survives a client that was offline when an instance
    closed, and the award is keyed by instance id inside a transaction so two
    devices asking at once pay once.

    XP is returned rather than written, as with checkpoints: the server decides
    IF and HOW MUCH, the client records it into the progress envelope and reports
    it to the weekly league.
    """
    client = _client()
    now = _utcnow()
    finished = _finished_entries(client, uid, now)
    ref = client.collection(RECORDS).document(uid)

    @firestore.transactional
    def _settle(transaction) -> list[dict]:
        snap = ref.get(transaction=transaction)
        data = (snap.to_dict() or {}) if snap.exists else {}
        settled = data.get("settled")
        settled = dict(settled) if isinstance(settled, dict) else {}

        granted: list[dict] = []
        for template, entry in finished:
            key = str(entry.get("instanceId") or entry.get("id"))
            if key in settled:
                continue
            award = _award_for(template, entry)
            award["at"] = _iso(now)
            settled[key] = award
            granted.append(award)

        if granted:
            transaction.set(
                ref,
                {
                    "uid": uid,
                    "settled": settled,
                    # Recomputed from the map rather than incremented, so a retry
                    # cannot inflate it.
                    "totalXp": sum(int(v.get("xp") or 0) for v in settled.values() if isinstance(v, dict)),
                    "completedCount": sum(1 for v in settled.values() if isinstance(v, dict) and v.get("completed")),
                    "updatedAt": _iso(now),
                },
                merge=True,
            )
        return granted

    try:
        granted = _settle(client.transaction())
    except Exception as exc:
        logger.error("challenge settlement failed for %s: %s", uid, exc)
        raise

    # The record map is the authority; this is a convenience flag so a settled
    # entry stops being re-read. A failure here costs nothing.
    for _template, entry in finished:
        if any(g["instanceId"] == entry.get("instanceId") for g in granted):
            try:
                client.collection(ENTRIES).document(str(entry.get("id"))).set({"settled": True}, merge=True)
            except Exception as exc:
                logger.warning("could not flag entry %s settled: %s", entry.get("id"), exc)

    return {
        "granted": granted,
        "xp": sum(int(g.get("xp") or 0) for g in granted),
        "badges": [g["badge"] for g in granted if g.get("badge")],
    }


def _record_for(client, uid: str) -> dict:
    try:
        snap = client.collection(RECORDS).document(uid).get()
        if snap.exists:
            data = snap.to_dict() or {}
            settled = data.get("settled")
            return {
                "settled": settled if isinstance(settled, dict) else {},
                "totalXp": int(data.get("totalXp") or 0),
                "completedCount": int(data.get("completedCount") or 0),
            }
    except Exception as exc:
        logger.warning("challenge record read failed for %s: %s", uid, exc)
    return {"settled": {}, "totalXp": 0, "completedCount": 0}


def _series_history(record: dict, challenge_id: str) -> dict:
    """How this learner has done at this series across every instance so far.

    Derived from the settled map rather than kept as counters, so nothing can
    drift out of step with the awards that were actually paid.
    """
    runs = [
        award
        for award in record["settled"].values()
        if isinstance(award, dict) and award.get("challengeId") == challenge_id
    ]
    ranks = [int(a["rank"]) for a in runs if isinstance(a.get("rank"), int)]
    return {
        "instancesPlayed": len(runs),
        "instancesCompleted": sum(1 for a in runs if a.get("completed")),
        "bestRank": min(ranks) if ranks else None,
        "xpEarned": sum(int(a.get("xp") or 0) for a in runs),
    }


def _remaining_seconds(end: datetime | None, now: datetime) -> int | None:
    if not end:
        return None
    return max(0, int((end - now).total_seconds()))


def _day_goal_join_window(template: dict) -> int:
    """How many days of its own window a day-counted goal stays joinable for.

    `durationDays - target + 1`, because a learner joining with fewer calendar
    days left than the target needs cannot clear it however hard they work. The
    corollary is worth stating once, plainly, because it constrains every target
    we will ever pick: **the last `target - 1` days of the window are always
    closed to new joiners**, so no day-counted target may equal its own window
    length (that leaves exactly one joinable day) and none can ever be joinable
    on the final day (that would take a target of one).

    Count-based goals are joinable for the whole window and report it as such.
    The season's `durationDays` is the nominal 90, one day shorter than three of
    the four real quarters, so this is the conservative figure for it.
    """
    days = max(1, int(template.get("durationDays") or 1))
    if template.get("metric") != METRIC_ACTIVE_DAYS:
        return days
    return max(0, days - _target(template) + 1)


def _joinable_now(template: dict, instance: dict, now: datetime) -> bool:
    """Whether the CURRENT instance can still be cleared by someone joining now.

    Only day-counting goals can become arithmetically impossible: five distinct
    days cannot fit into three. Count-based goals stay joinable to the last hour
    because they genuinely are.

    The bar is the INSTANCE's, not the template's, for the same reason
    `_ensure_entry` uses it: the round this learner would enter froze its target
    when it opened, and answering "is it reachable" against a freshly retuned
    number would wave someone into a round whose entry they cannot clear.

    The window this opens is exactly `durationDays - target + 1` days wide, which
    is why no day-counted target may equal its own window length. See
    `_day_goal_join_window` and the invariant it exists to make testable.
    """
    end = _parse_iso(instance.get("endsAt"))
    if template.get("metric") != METRIC_ACTIVE_DAYS or not end:
        return True
    # CALENDAR days remaining, not seconds divided by 86400. Monday 00:05 has six
    # and a half 24-hour periods left in the week and seven distinct days on which
    # a learner can be active, and a seconds-based count would refuse the first
    # five minutes of every single week.
    last_day = (end - timedelta(seconds=1)).astimezone(timezone.utc).date()
    remaining_days = (last_day - now.astimezone(timezone.utc).date()).days + 1
    return remaining_days >= _instance_target(instance, template)


def _public_instance(instance: dict, now: datetime) -> dict:
    end = _parse_iso(instance.get("endsAt"))
    return {
        "instanceId": instance.get("id"),
        "periodKey": instance.get("periodKey"),
        "status": instance.get("status", STATUS_OPEN),
        "startsAt": instance.get("startsAt"),
        "endsAt": instance.get("endsAt"),
        # A countdown, never a wall-clock deadline: the UTC anchor is not
        # something a learner should ever have to reason about.
        "endsInSeconds": _remaining_seconds(end, now),
        "participantCount": max(0, int(instance.get("participantCount") or 0)),
    }


@router.get("/stats")
def community_stats(claims: dict = Depends(require_claims)) -> dict:
    """Social counters the client cannot observe about itself.

    Likes RECEIVED live on other people's screens: a client only ever sees the
    likes it *gives*, so three achievements ("Well Liked", "Crowd Favourite",
    "Community Hero") were unearnable no matter how popular a build got. The
    count is summed server-side from the author's own posts, which keeps it
    honest — a client cannot inflate a number it never writes.

    Posts and comments are returned from the same authoritative source so the
    achievement screen agrees with the feed even if local state was cleared or
    the user signed in on a second device.
    """
    uid = claims["uid"]
    client = _client()

    likes_received = 0
    posts = 0
    for snap in client.collection(POSTS).where(filter=FieldFilter("uid", "==", uid)).stream():
        p = snap.to_dict() or {}
        posts += 1
        # Hidden (reported) posts still count: moderation is not a punishment
        # for the likes a post already earned.
        likes_received += max(0, int(p.get("likes") or 0))

    comments = sum(
        1 for _ in client.collection(COMMENTS).where(filter=FieldFilter("uid", "==", uid)).stream()
    )

    return {"likesReceived": likes_received, "posts": posts, "comments": comments}


def forget_uid(client, uid: str) -> int:
    """Scrub a deleted account out of the FROZEN standings of closed instances.

    Standings are the one place a uid and a display name outlive the documents
    that erasure reaches by uid: they are copied into an array on a shared
    instance document at close, and no query can find an array element by an
    inner field. So the entries are used as the index into which instances a
    learner ever appeared in, which is why this must run BEFORE the entry purge.

    The row is anonymised rather than removed: deleting it would renumber every
    rank below it and rewrite a result other people already saw. Returns the
    number of instances changed.
    """
    changed = 0
    instance_ids: set[str] = set()
    try:
        for snap in (
            client.collection(ENTRIES).where(filter=FieldFilter("uid", "==", uid)).limit(MAX_ENTRY_SCAN).stream()
        ):
            value = (snap.to_dict() or {}).get("instanceId")
            if isinstance(value, str) and value:
                instance_ids.add(value)
    except Exception as exc:
        logger.error("standings scrub index failed for %s: %s", uid, exc)
        return 0

    for instance_id in instance_ids:
        try:
            ref = client.collection(INSTANCES).document(instance_id)
            snap = ref.get()
            if not snap.exists:
                continue
            data = snap.to_dict() or {}
            rows = data.get("standings")
            if not isinstance(rows, list):
                continue
            touched = False
            scrubbed = []
            for row in rows:
                if isinstance(row, dict) and row.get("uid") == uid:
                    scrubbed.append({**row, "uid": None, "name": "Deleted account"})
                    touched = True
                else:
                    scrubbed.append(row)
            update: dict[str, Any] = {}
            winner = data.get("winner")
            if isinstance(winner, dict) and winner.get("uid") == uid:
                update["winner"] = {"uid": None, "name": "Deleted account"}
                touched = True
            if not touched:
                continue
            update["standings"] = scrubbed
            ref.set(update, merge=True)
            changed += 1
        except Exception as exc:
            # One instance failing must not abandon the rest of the scrub.
            logger.error("standings scrub failed for %s in %s: %s", uid, instance_id, exc)
    return changed


# ── Challenge routes ──
def _ensure_challenges(client) -> dict[str, dict]:
    """Seed the challenge series, and keep their content fresh (idempotent).

    New series are created with a zeroed participant counter. Existing ones get
    their *content and lifecycle* fields merged in without touching the live
    `participantCount`, `currentPeriodKey`, `pendingClose` or `createdAt`, so
    editing copy or retuning a target here rolls out on the next read without a
    migration script.

    Returns the series documents it read, so the caller renders cards from them
    without paying for a second read of the same seven documents.
    """
    col = client.collection(CHALLENGES)
    series: dict[str, dict] = {}
    for c in DEFAULT_CHALLENGES:
        ref = col.document(c["id"])
        snap = ref.get()
        if snap.exists:
            stored = snap.to_dict() or {}
            if any(stored.get(key) != value for key, value in c.items()):
                # Only when the copy actually changed. Rewriting seven documents
                # on every Community open is seven writes per reader for nothing,
                # and it makes every join and every rollover transaction on those
                # same documents retry.
                ref.set(c, merge=True)  # refresh content only; pointers untouched
            series[c["id"]] = {**stored, **c}
        else:
            doc = {**c, "participantCount": 0, "createdAt": _now()}
            ref.set(doc)
            series[c["id"]] = doc
    return series


def _series_members(series: dict | None) -> int | None:
    """The durable enrolment count on the series document, if it has one."""
    if not isinstance(series, dict):
        return None
    count = series.get("participantCount")
    return max(0, int(count)) if isinstance(count, (int, float)) else None


def _challenge_card(
    client,
    template: dict,
    uid: str,
    name: str,
    record: dict,
    enrolment: dict | None,
    now: datetime,
    series: dict | None = None,
) -> dict:
    """One challenge as the client renders it: the series, its live instance, and
    the caller's own run at it."""
    challenge_id = template["id"]
    rolling = template.get("cadence") == CADENCE_ROLLING
    entry: dict | None = None
    instance: dict | None = None

    enrolled_for = "current"

    if rolling:
        if enrolment:
            entry = _ensure_rolling_entry(client, template, enrolment, uid, name, now)
            if entry:
                entry = _finalise_rolling_entry(client, entry, now)
        ends = _parse_iso(entry.get("endsAt")) if entry else None
        instance_public = {
            "instanceId": entry.get("id") if entry else None,
            "periodKey": entry.get("periodKey") if entry else None,
            "status": STATUS_CLOSED if (entry or {}).get("closedAt") else STATUS_OPEN,
            "startsAt": entry.get("startsAt") if entry else None,
            "endsAt": entry.get("endsAt") if entry else None,
            "endsInSeconds": _remaining_seconds(ends, now),
            "participantCount": 0,
        }
        joinable = True
    else:
        instance = _current_instance(client, template, now)
        if enrolment and enrolment.get("active") is not False:
            skip = enrolment.get("skipPeriodKey")
            if isinstance(skip, str) and skip == instance.get("periodKey"):
                # Enrolled, but for the NEXT instance: they joined a day-counting
                # week they could not have finished. The card has to say so, or it
                # reads as a challenge that refuses to count.
                enrolled_for = "next"
            entry = _ensure_entry(client, template, instance, uid, name, skip)
            # Cheap: a cache hit unless the entry above was newly created.
            instance = _current_instance(client, template, now)
        instance_public = _public_instance(instance, now)
        joinable = _joinable_now(template, instance, now)

    live = entry if entry and not entry.get("closedAt") else None
    # The bar this learner is actually being judged against. An entry keeps the
    # target it was created with, so that retuning a target never moves the bar
    # under a run already in flight. The card has to show the same number, or a
    # learner mid-week reads a full bar that pays nothing and says nothing: five
    # of five drawn from the template while the entry completes at seven.
    target = int((live or {}).get("target") or _target(template))
    members = _series_members(series)
    return {
        **template,
        # The DURABLE count of everyone enrolled in the series, which is what the
        # card has always shown. The number for this round alone is on the
        # instance: showing that here would empty every card at every rollover,
        # and read as nobody having joined rather than a week having turned.
        "participantCount": instance_public["participantCount"] if members is None else members,
        "joined": bool(enrolment and enrolment.get("active") is not False),
        "progress": int((live or {}).get("progress") or 0),
        "target": target,
        "completed": bool((live or {}).get("completed")),
        "ranked": _is_ranked(template),
        "joinableNow": joinable,
        # "next" means: in the series, but sitting this instance out. The client
        # renders the wait honestly instead of a bar that will never move.
        "enrolledFor": enrolled_for,
        "endsInSeconds": instance_public["endsInSeconds"],
        "instance": instance_public,
        "history": _series_history(record, challenge_id),
    }


@router.get("/challenges")
def list_challenges(claims: dict = Depends(require_claims)) -> dict:
    """Every series, its live instance, and the caller's run at each."""
    uid = claims["uid"]
    name = _display_name(claims)
    client = _client()
    series = _ensure_challenges(client)
    now = _utcnow()
    record = _record_for(client, uid)
    enrolments = {str(e.get("challengeId")): e for e in _enrolments_for(client, uid)}

    out = [
        _challenge_card(
            client, template, uid, name, record, enrolments.get(template["id"]), now,
            series.get(template["id"]),
        )
        for template in DEFAULT_CHALLENGES
    ]
    out.sort(key=lambda c: (c.get("order", 99), c.get("title", "")))
    return {"challenges": out, "unclaimedResults": _unclaimed_count(client, uid, record, now)}


def _unclaimed_count(client, uid: str, record: dict, now: datetime) -> int:
    """How many finished instances are waiting to be claimed. Drives the badge on
    the Community tab, so it must never guess: it counts real closed entries."""
    try:
        return sum(
            1
            for _template, entry in _finished_entries(client, uid, now)
            if str(entry.get("instanceId") or entry.get("id")) not in record["settled"]
        )
    except Exception as exc:
        logger.warning("unclaimed count failed for %s: %s", uid, exc)
        return 0


@router.get("/challenges/mine")
def my_challenges(claims: dict = Depends(require_claims)) -> dict:
    """The caller's own view: what they are running, and what is waiting to be claimed."""
    uid = claims["uid"]
    name = _display_name(claims)
    client = _client()
    now = _utcnow()
    record = _record_for(client, uid)

    running = []
    for template, entry in _live_entries_for(client, uid, name, now):
        ends = _parse_iso(entry.get("endsAt"))
        running.append({
            "challengeId": template["id"],
            "title": template.get("title", ""),
            "art": template.get("art"),
            "theme": template.get("theme"),
            "cadence": template.get("cadence"),
            "goal": template.get("goal"),
            "instanceId": entry.get("instanceId"),
            "periodKey": entry.get("periodKey"),
            "progress": int(entry.get("progress") or 0),
            "target": int(entry.get("target") or _target(template)),
            "completed": bool(entry.get("completed")),
            "ranked": bool(entry.get("ranked", _is_ranked(template))),
            "endsInSeconds": _remaining_seconds(ends, now),
        })

    pending = []
    for template, entry in _finished_entries(client, uid, now):
        key = str(entry.get("instanceId") or entry.get("id"))
        if key in record["settled"]:
            continue
        pending.append(_award_for(template, entry))

    return {
        "running": sorted(running, key=lambda r: r["endsInSeconds"] if r["endsInSeconds"] is not None else 1 << 30),
        "unclaimed": pending,
        "totalXp": record["totalXp"],
        "completedCount": record["completedCount"],
        "history": sorted(
            [a for a in record["settled"].values() if isinstance(a, dict)],
            key=lambda a: str(a.get("at") or ""),
            reverse=True,
        )[:50],
    }


@router.post("/challenges/claim")
def claim_challenges(claims: dict = Depends(require_non_minor)) -> dict:
    """Settle every finished challenge the caller has not been paid for.

    Idempotent: the award is keyed by instance id inside a transaction on the
    caller's record, so a second call, or a second device, grants zero.
    """
    return settle_for(claims["uid"])


def _live_standings(client, template: dict, instance_id: str, uid: str) -> list[dict]:
    rows = _rank_entries(_entries_for_instance(client, instance_id))[:MAX_STANDINGS]
    return [
        {
            "rank": i + 1,
            "name": r.get("name") or "Builder",
            "progress": int(r.get("progress") or 0),
            "target": int(r.get("target") or _target(template)),
            "completed": bool(r.get("completed")),
            "isMe": r.get("uid") == uid,
        }
        for i, r in enumerate(rows)
    ]


@router.get("/challenges/{challenge_id}/standings")
def challenge_standings(challenge_id: str, claims: dict = Depends(require_claims)) -> dict:
    """Live standings for the open instance. Rolling challenges are unranked."""
    template = TEMPLATES.get(challenge_id)
    if not template:
        raise HTTPException(404, "Challenge not found.")
    if not _is_ranked(template):
        return {"ranked": False, "standings": [], "instance": None}
    client = _client()
    now = _utcnow()
    instance = _current_instance(client, template, now)
    return {
        "ranked": True,
        "instance": _public_instance(instance, now),
        "standings": _live_standings(client, template, instance["id"], claims["uid"]),
    }


@router.get("/challenges/{challenge_id}/results")
def challenge_results(
    challenge_id: str, period: str | None = None, claims: dict = Depends(require_claims)
) -> dict:
    """Frozen results for a closed instance, defaulting to the most recent one.

    The standings here were computed once at close and are never recomputed, so
    two learners opening this a month apart see the same podium.
    """
    template = TEMPLATES.get(challenge_id)
    if not template:
        raise HTTPException(404, "Challenge not found.")
    if not _is_ranked(template):
        raise HTTPException(404, "This challenge is not ranked.")

    client = _client()
    uid = claims["uid"]
    instance: dict | None = None

    if period:
        snap = client.collection(INSTANCES).document(_instance_id(challenge_id, period)).get()
        if snap.exists:
            instance = snap.to_dict() or {}
    else:
        closed = [
            (snap.to_dict() or {})
            for snap in client.collection(INSTANCES)
            .where(filter=FieldFilter("challengeId", "==", challenge_id))
            .limit(MAX_ENROLMENTS)
            .stream()
        ]
        # A week nobody entered had no standings to freeze, so it is not a
        # result: showing its empty podium would be the first thing a learner
        # saw after a quiet week. An explicitly requested `period` still returns
        # it, because that is someone asking for that week by name.
        closed = [
            c for c in closed
            if c.get("status") == STATUS_CLOSED and int(c.get("participantCount") or 0) > 0
        ]
        closed.sort(key=lambda c: str(c.get("periodKey") or ""), reverse=True)
        instance = closed[0] if closed else None

    if not instance or instance.get("status") != STATUS_CLOSED:
        raise HTTPException(404, "No finished round yet.")

    standings = [
        {**row, "isMe": row.get("uid") == uid}
        for row in (instance.get("standings") or [])
        if isinstance(row, dict)
    ]
    mine = next((row for row in standings if row["isMe"]), None)
    return {
        "challengeId": challenge_id,
        "title": template.get("title", ""),
        "periodKey": instance.get("periodKey"),
        "closedAt": instance.get("closedAt"),
        "participantCount": int(instance.get("participantCount") or 0),
        "completedCount": int(instance.get("completedCount") or 0),
        "target": int(instance.get("target") or _target(template)),
        "winner": instance.get("winner"),
        "standings": [{k: v for k, v in row.items() if k != "uid"} for row in standings],
        "me": {k: v for k, v in mine.items() if k != "uid"} if mine else None,
    }


def _enrol(client, challenge_id: str, member_ref, enrolment: dict) -> tuple[int, bool]:
    """Write the series enrolment and move the durable member count with it.

    The count lives on the series document because that is what the card shows:
    how many people are IN this challenge, which does not become zero because a
    week turned. Check-then-increment across two statements let a double tap
    count twice, so both happen in one serialized step, and the count only moves
    when the enrolment is genuinely new.

    Returns (participantCount, firstEver). `firstEver` is true only the first time
    this learner has ever joined this series, and it is what the clients credit
    the achievement on. It is deliberately NOT the same question as "is this
    enrolment new": leaving deletes the enrolment, so a join, leave, join loop
    looks new every time, and crediting on that made "Joined a challenge" and
    "Joined 5 challenges" earnable from one card by tapping two buttons. The
    history document answers the durable question and is never deleted.
    """
    series_ref = client.collection(CHALLENGES).document(challenge_id)
    uid = str(enrolment.get("uid") or "")
    history_ref = client.collection(JOIN_HISTORY).document(f"{challenge_id}__{uid}")

    @firestore.transactional
    def _apply(transaction) -> tuple[int, bool]:
        # Every read must precede every write inside a Firestore transaction.
        series_snap = series_ref.get(transaction=transaction)
        member_snap = member_ref.get(transaction=transaction)
        history_snap = history_ref.get(transaction=transaction)

        count = int((series_snap.to_dict() or {}).get("participantCount", 0)) if series_snap.exists else 0
        already = member_snap.exists and (member_snap.to_dict() or {}).get("active") is not False
        first_ever = not history_snap.exists

        transaction.set(member_ref, enrolment, merge=True)
        if first_ever:
            transaction.set(history_ref, {"challengeId": challenge_id, "uid": uid, "firstJoinedAt": _now()})
        if not already:
            count = max(0, count) + 1
            transaction.set(series_ref, {"participantCount": count}, merge=True)
        return max(0, count), first_ever

    return _apply(client.transaction())


def _unenrol(client, challenge_id: str, member_ref) -> tuple[int, dict | None]:
    """Drop the enrolment, decrement once, never below zero. Returns the count
    and the row that was removed, since the caller needs its window."""
    series_ref = client.collection(CHALLENGES).document(challenge_id)

    @firestore.transactional
    def _apply(transaction) -> tuple[int, dict | None]:
        series_snap = series_ref.get(transaction=transaction)
        count = int((series_snap.to_dict() or {}).get("participantCount", 0)) if series_snap.exists else 0
        member_snap = member_ref.get(transaction=transaction)
        if not member_snap.exists:
            return max(0, count), None
        member = member_snap.to_dict() or {}
        transaction.delete(member_ref)
        if member.get("active") is not False:
            count = max(0, count - 1)
            transaction.set(series_ref, {"participantCount": count}, merge=True)
        return max(0, count), member

    return _apply(client.transaction())


@router.post("/challenges/{challenge_id}/join")
def join_challenge(challenge_id: str, claims: dict = Depends(require_non_minor)) -> dict:
    """Enrol in a series and enter the instance that is running.

    Enrolment is in the SERIES, not the instance, which is what makes a rollover
    invisible: next week's entry is created for them without a second join.

    One case does not enter the current instance. If the goal counts days and
    fewer days remain than the target needs, the instance is not merely hard, it
    is arithmetically impossible, so the enrolment is booked for the next one and
    the response says so.
    """
    template = TEMPLATES.get(challenge_id)
    if not template:
        raise HTTPException(404, "Challenge not found.")
    uid = claims["uid"]
    name = _display_name(claims)
    client = _client()
    now = _utcnow()
    member_ref = client.collection(MEMBERS).document(f"{challenge_id}__{uid}")
    rolling = template.get("cadence") == CADENCE_ROLLING

    if rolling:
        period_key, start, end = _rolling_window(template, now)
        members, first_join = _enrol(
            client,
            challenge_id,
            member_ref,
            {
                "challengeId": challenge_id,
                "uid": uid,
                "cadence": CADENCE_ROLLING,
                "periodKey": period_key,
                "active": True,
                "enrolledFor": "current",
                "joinedAt": _now(),
            },
        )
        entry_ref = client.collection(ENTRIES).document(
            _entry_id(_instance_id(challenge_id, period_key), uid)
        )
        if not entry_ref.get().exists:
            entry_ref.set(_rolling_entry_doc(template, uid, name, period_key, start, end))
        return {
            "joined": True,
            "firstJoin": first_join,
            "participantCount": members,
            "enrolledFor": "current",
            "progress": 0,
            "target": _target(template),
            "endsInSeconds": _remaining_seconds(end, now),
        }

    instance = _current_instance(client, template, now)
    feasible = _joinable_now(template, instance, now)
    if not feasible:
        # Worth a line each time: this is the product turning someone away from
        # the round in front of them, and how often it happens is the measure of
        # whether a target is still the right size for its window.
        logger.info(
            "join booked for the next instance of %s: %s arrived with the goal out of reach "
            "(joinable for %d of %d days)",
            challenge_id,
            uid,
            _day_goal_join_window(template),
            max(1, int(template.get("durationDays") or 1)),
        )
    members, first_join = _enrol(
        client,
        challenge_id,
        member_ref,
        {
            "challengeId": challenge_id,
            "uid": uid,
            "cadence": template.get("cadence"),
            "active": True,
            "enrolledFor": "current" if feasible else "next",
            # The period they are NOT in. Without this the enrolment alone says
            # "in the series", and the next read would enter them into exactly
            # the instance this branch just declined to enter them into.
            "skipPeriodKey": None if feasible else instance.get("periodKey"),
            "joinedAt": _now(),
        },
    )

    entry = _ensure_entry(client, template, instance, uid, name) if feasible else None
    return {
        "joined": True,
        "firstJoin": first_join,
        "participantCount": members,
        "enrolledFor": "current" if feasible else "next",
        "progress": int((entry or {}).get("progress") or 0),
        # The bar on the entry that was just written, so the confirmation names
        # the number this learner is judged against. Someone booked for the NEXT
        # round has no entry yet and is answered with the template's target,
        # which is what that round will open with.
        "target": int((entry or {}).get("target") or 0) or _target(template),
        "endsInSeconds": _remaining_seconds(_parse_iso(instance.get("endsAt")), now),
    }


@router.post("/challenges/{challenge_id}/leave")
def leave_challenge(challenge_id: str, claims: dict = Depends(require_non_minor)) -> dict:
    """Leave a series: drop the enrolment and forfeit the current instance.

    Idempotent (leaving twice is a no-op). Finished instances are NOT touched:
    leaving gives up the run in progress, not the history of the ones already
    won, and an unclaimed award stays claimable.
    """
    template = TEMPLATES.get(challenge_id)
    if not template:
        raise HTTPException(404, "Challenge not found.")
    uid = claims["uid"]
    client = _client()
    now = _utcnow()
    member_ref = client.collection(MEMBERS).document(f"{challenge_id}__{uid}")
    members, member = _unenrol(client, challenge_id, member_ref)

    if template.get("cadence") == CADENCE_ROLLING:
        period_key = (member.get("periodKey") if member else None) or ""
        if period_key:
            entry_ref = client.collection(ENTRIES).document(
                _entry_id(_instance_id(challenge_id, period_key), uid)
            )
            snap = entry_ref.get()
            if snap.exists and not (snap.to_dict() or {}).get("closedAt"):
                entry_ref.delete()
        return {"joined": False, "participantCount": members}

    instance = _current_instance(client, template, now)
    entry_ref = client.collection(ENTRIES).document(_entry_id(str(instance.get("id")), uid))
    inst_ref = client.collection(INSTANCES).document(str(instance.get("id")))

    @firestore.transactional
    def _drop(transaction) -> int:
        inst_snap = inst_ref.get(transaction=transaction)
        count = int((inst_snap.to_dict() or {}).get("participantCount", 0)) if inst_snap.exists else 0
        entry_snap = entry_ref.get(transaction=transaction)
        if entry_snap.exists and not (entry_snap.to_dict() or {}).get("closedAt"):
            transaction.delete(entry_ref)
            count = max(0, count - 1)
            transaction.set(inst_ref, {"participantCount": count}, merge=True)
        return count

    _drop(client.transaction())
    _instance_cache.invalidate(str(instance.get("id")))
    # The series count, not this round's: it is the number the card renders, and
    # the two must agree or leaving makes the card jump.
    return {"joined": False, "participantCount": members}


# ── Weekly league ──
@router.post("/xp")
async def report_xp(request: Request, claims: dict = Depends(require_non_minor)) -> dict:
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
