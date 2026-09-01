"""Career coaching, grounded in what Ohmlet can actually PROVE about a learner.

The research on this was blunt: company-specific interview prep is already sold
by Snubber for twenty-plus named firms at $35 a month, built by a former SpaceX
engineer. Ohmlet cannot win that, and Max must not lead on it.

What no incumbent can reach is **verified build evidence**. Every CV in hardware
claims bench experience and every interviewer discounts it, because there is no
way to check. Yoodli cannot know whether you have held a probe. Snubber cannot
either. Ohmlet can, because the evidence is a by-product of the product working:

  * `image_frames > 0` in a live session means the CAMERA WAS ON. Not a
    simulation, not a video: a phone pointed at a real bench with a real tutor
    watching. This is the single hardest thing in here to fake and the single
    most valuable thing to be able to say.
  * Boss scores are assessed under exam conditions, drawn across a whole unit,
    graded server-side. "Completed the unit" is a click; 87% on a unit exam is a
    measurement.
  * A 3D twin is an artefact of a build that reached the end.
  * Lesson levels distinguish having seen something from having drilled it to
    Gold.

None of that is self-reported, and none of it can be inflated from the client:
every source here is a server-owned record.

**What this module refuses to do.** It does not score a person, rank them, or
predict whether they will get hired. It assembles evidence and names gaps. The
coaching conversation is where judgement happens, with a human in the loop and
the facts in front of it, and the facts are deliberately reported with their own
limits attached: 40 minutes of bench time is 40 minutes, not "hands-on
experience".
"""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger("ohmlet.career")

USAGE_COLLECTION = os.getenv("OHMLET_USAGE_COLLECTION", "usage_sessions")
STATE_COLLECTION = os.getenv("OHMLET_STATE_COLLECTION", "ohmlet_state")
TWINS_COLLECTION = os.getenv("OHMLET_TWINS_COLLECTION", "ohmlet_twins")

# Below this, a session is a connection test rather than bench work. Chosen from
# the real distribution: the only sessions recorded to date are nine test
# connections averaging a minute, and counting those as bench experience would
# make the whole record a lie on day one.
MIN_BENCH_SECONDS = float(os.getenv("OHMLET_MIN_BENCH_SECONDS", "180"))


def _bench(client, uid: str) -> dict[str, Any]:
    """Real time at a real bench, and how much of it had the camera open."""
    from google.cloud.firestore_v1.base_query import FieldFilter

    total = 0.0
    with_camera = 0.0
    sessions = 0
    camera_sessions = 0
    try:
        rows = (
            client.collection(USAGE_COLLECTION)
            .where(filter=FieldFilter("user_id", "==", uid))
            .stream()
        )
        for snap in rows:
            d = snap.to_dict() or {}
            secs = float(d.get("duration_seconds") or 0)
            if secs < MIN_BENCH_SECONDS:
                continue
            sessions += 1
            total += secs
            if int(d.get("image_frames") or 0) > 0:
                camera_sessions += 1
                with_camera += secs
    except Exception as exc:
        logger.warning("bench evidence unavailable for %s: %s", uid, exc)

    return {
        "sessions": sessions,
        "minutes": round(total / 60.0),
        "cameraSessions": camera_sessions,
        # The line worth putting on a CV, and the one nobody else can produce.
        "cameraMinutes": round(with_camera / 60.0),
    }


def _learning(client, uid: str) -> dict[str, Any]:
    levels: dict[str, int] = {}
    try:
        snap = client.collection(STATE_COLLECTION).document(uid).get()
        if snap.exists:
            data = (snap.to_dict() or {}).get("data") or {}
            got = data.get("lessonLevels")
            if isinstance(got, dict):
                levels = {k: int(v or 0) for k, v in got.items()}
    except Exception as exc:
        logger.warning("state unavailable for %s: %s", uid, exc)

    import curriculum

    try:
        total = sum(
            len(s.get("lessons", []))
            for u in curriculum._curriculum().get("units", [])
            for s in u.get("skills", [])
        )
    except Exception:
        total = 0

    return {
        "completed": len(levels),
        "total": total,
        # Gold means the hardest slice of the question pool, drilled. Seen and
        # drilled are different claims and should not be collapsed.
        "gold": sum(1 for v in levels.values() if v >= 3),
    }


def _assessed(client, uid: str) -> dict[str, Any]:
    """Unit exams: the only measurement in here taken under exam conditions."""
    import bosses

    cleared: list[dict[str, Any]] = []
    weakest: list[dict[str, Any]] = []
    try:
        record = bosses._record(client, uid)
    except Exception as exc:
        logger.warning("boss record unavailable for %s: %s", uid, exc)
        record = {}

    index = bosses._unit_index()
    for unit_id, row in (record or {}).items():
        if not isinstance(row, dict):
            continue
        meta = index.get(unit_id) or {}
        entry = {
            "unitId": unit_id,
            "title": meta.get("title", unit_id),
            "score": round(float(row.get("bestRatio") or 0) * 100),
            "attempts": int(row.get("attempts") or 0),
        }
        (cleared if row.get("cleared") else weakest).append(entry)

    cleared.sort(key=lambda e: -e["score"])
    return {
        "unitsCleared": len(cleared),
        "unitsTotal": len(index),
        "meanScore": round(sum(e["score"] for e in cleared) / len(cleared)) if cleared else 0,
        "strongest": cleared[:3],
        # Attempted and not cleared is the most useful thing in the whole record
        # for a coaching conversation: it is a gap the learner already met.
        "attemptedNotCleared": weakest,
    }


def _artifacts(client, uid: str) -> dict[str, Any]:
    from google.cloud.firestore_v1.base_query import FieldFilter

    twins = 0
    try:
        for snap in client.collection(TWINS_COLLECTION).where(filter=FieldFilter("uid", "==", uid)).stream():
            if (snap.to_dict() or {}).get("status") == "ready":
                twins += 1
    except Exception as exc:
        logger.warning("twin evidence unavailable for %s: %s", uid, exc)
    return {"twins": twins}


def evidence(uid: str) -> dict[str, Any]:
    """Everything Ohmlet can attest to about this learner. Server records only."""
    from state_store import get_client

    client = get_client()
    bench = _bench(client, uid)
    learning = _learning(client, uid)
    assessed = _assessed(client, uid)
    artifacts = _artifacts(client, uid)

    return {
        "bench": bench,
        "learning": learning,
        "assessed": assessed,
        "artifacts": artifacts,
        # Stated so neither the coach nor the learner overclaims. Every number
        # above is a floor: it is what we watched happen, not everything they
        # have ever done.
        "caveat": (
            "This is what Ohmlet observed, not a complete history. Bench minutes "
            "count only sessions over "
            f"{int(MIN_BENCH_SECONDS / 60)} minutes, and camera minutes count only "
            "sessions where the camera was actually open."
        ),
    }


def summary_line(ev: dict[str, Any]) -> str:
    """One sentence a learner could defensibly put in front of an interviewer."""
    b, a, art = ev["bench"], ev["assessed"], ev["artifacts"]
    parts = []
    if b["cameraMinutes"]:
        parts.append(f"{b['cameraMinutes']} minutes at a real bench with the camera open across {b['cameraSessions']} sessions")
    if a["unitsCleared"]:
        parts.append(f"{a['unitsCleared']} unit exams passed at a mean of {a['meanScore']}%")
    if art["twins"]:
        parts.append(f"{art['twins']} completed builds captured as 3D models")
    if not parts:
        return "No verified bench work yet. That is the first thing to change."
    return "Verified on Ohmlet: " + "; ".join(parts) + "."
