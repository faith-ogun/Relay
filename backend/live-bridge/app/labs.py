"""Ohmlet Labs: unfinished features, switched on early for the people who pay most.

The pricing page has promised "early access to Ohmlet Labs" on the Max tier for
a while and nothing behind it existed. The temptation was to delete the line.
Faith's instruction was the opposite, and it is the right one: build the thing
rather than quietly shrink the promise.

**What Labs actually is.** A feature is in Labs when it works but is not finished:
rough edges, missing states, a shape that might still change. Labs is where those
go to meet real users instead of sitting on a branch. Max subscribers get them
first, which is a real benefit rather than a badge, and they graduate to
everybody once they hold up.

That direction matters. A Labs feature is on its way OUT of Labs, not parked in
it. If something sits at stage "max" for months it has stopped being early access
and become a paywall wearing a lab coat, and the honest move then is either to
finish it and release it or to price it openly as a Max feature.

**Stages**

    off   built, not switched on for anyone. Visible here, not to users.
    max   early access. Max subscribers only. THIS is what the tier buys.
    all   graduated. Everyone, and the entry stays only as a record of when.

The gate is server-side and keyed on the plan the server reads, exactly like
Interview Mode. A client asking "am I allowed?" is not a gate.
"""

from __future__ import annotations

import os
from typing import Any

import entitlements

STAGES = ("off", "max", "all")


def _stage(key: str, default: str) -> str:
    """Stage is env-overridable so a feature can be graduated, or pulled back
    when it misbehaves, without a deploy. A typo falls back to `off`, because
    failing towards not-shipping-something-broken is the safe direction."""
    value = os.getenv(f"OHMLET_LAB_{key.upper().replace('-', '_')}", default)
    return value if value in STAGES else "off"


def catalogue() -> dict[str, dict[str, Any]]:
    """Every Labs feature, whatever its stage.

    Each entry says what it IS, not what it will be, and what is still rough
    about it. A learner opting into an unfinished feature deserves to know which
    part is unfinished; that honesty is most of what makes early access feel
    like a privilege rather than a beta-test conscription.
    """
    return {
        "lesson-films": {
            "title": "Lesson films",
            "blurb": "A three minute film at every checkpoint, showing what the "
                     "lessons can only describe: current stopping when a wire is cut, "
                     "a capacitor filling, a transistor switching a load.",
            "rough": "No offline download yet, and the films stream from one region, "
                     "so playback outside Europe can be slow to start.",
            "stage": _stage("lesson_films", "max"),
            "since": "2026-08-28",
        },
    }


def available_to(plan: str) -> list[dict[str, Any]]:
    """The Labs features this plan can actually use, newest first."""
    p = entitlements.normalize_plan(plan)
    out = []
    for key, entry in catalogue().items():
        stage = entry["stage"]
        if stage == "all" or (stage == "max" and p == "max"):
            out.append({"id": key, **entry, "earlyAccess": stage == "max"})
    return sorted(out, key=lambda e: e["since"], reverse=True)


def is_on(feature: str, plan: str) -> bool:
    """Server-side gate for one Labs feature. The only thing that decides."""
    entry = catalogue().get(feature)
    if not entry:
        return False
    stage = entry["stage"]
    if stage == "all":
        return True
    return stage == "max" and entitlements.normalize_plan(plan) == "max"


def status(plan: str) -> dict[str, Any]:
    """What to show on the Labs screen.

    `comingToEveryone` is deliberately included for non-Max plans: a learner who
    cannot use a feature yet should still be able to see that it exists and that
    it is coming, rather than being shown an empty screen that reads as a bug.
    """
    p = entitlements.normalize_plan(plan)
    mine = available_to(p)
    mine_ids = {e["id"] for e in mine}
    upcoming = [
        {"id": k, "title": v["title"], "blurb": v["blurb"]}
        for k, v in catalogue().items()
        if v["stage"] == "max" and k not in mine_ids
    ]
    return {
        "plan": p,
        "labs": mine,
        "comingToEveryone": upcoming,
        "hasEarlyAccess": p == "max",
    }
