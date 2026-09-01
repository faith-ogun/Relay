"""Turning an interview's weaknesses into lessons the learner can actually open.

This is the whole reason Interview Mode belongs on Ohmlet rather than on any of
the half dozen products that already do AI mock interviews. Yoodli, Huru and
Final Round can tell you that you were weak on decoupling capacitors. None of
them owns 284 lessons about decoupling capacitors, so none of them can do
anything about it.

Ohmlet could and did not. `recommendedTopics` was an array of free text: the
report said "RTOS mutexes and priority inversion" and linked nowhere. A learner
read a diagnosis and was left to search for the cure.

Two jobs here, and the second one is the honest half.

**Route what we teach.** A recommended topic is constrained to a real skill id
from the authored curriculum, so the report deep-links into the lesson that
closes the gap. The model is given the catalogue as an enum rather than asked
politely, because a model asked politely will invent `rtos-basics`.

**Admit what we do not.** The interviewer is instructed to probe RTOS,
`volatile`, Nyquist, CAN bus, metastability, KiCad, logic analysers, sensor
fusion, odometry and field-oriented control. Every one of those scores ZERO
mentions across all 2,355 authored steps. The product can diagnose gaps it cannot
close, which is worse than not diagnosing them: it is a paid feature telling a
learner what to study and having nothing to study.

So an uncovered topic is reported as uncovered, plainly, rather than mapped onto
the nearest lesson that happens to share a word. And it is COUNTED, because the
set of things real candidates get asked and Ohmlet cannot teach is the most
honest curriculum backlog the product will ever have: written by the job market
rather than by us.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

logger = logging.getLogger("ohmlet.interview.gaps")


@lru_cache(maxsize=1)
def skill_catalogue() -> dict[str, dict[str, str]]:
    """skillId -> {title, unitId, unitTitle}, from the authored curriculum.

    Read rather than listed, so it cannot drift from the thing it indexes.
    """
    import curriculum

    out: dict[str, dict[str, str]] = {}
    try:
        data = curriculum._curriculum()
    except Exception as exc:
        logger.error("curriculum unavailable for gap routing: %s", exc)
        return out
    for unit in data.get("units", []):
        for skill in unit.get("skills", []):
            sid = skill.get("id")
            if not sid or sid.endswith(("-check", "-gateway")):
                continue
            out[sid] = {
                "title": skill.get("title", ""),
                "unitId": unit.get("id", ""),
                "unitTitle": unit.get("title", ""),
            }
    return out


def skill_ids() -> list[str]:
    return sorted(skill_catalogue())


def catalogue_for_prompt() -> str:
    """The skill list, as the model sees it.

    Grouped by unit and given with titles, because an id alone
    (`opamp-real-world`) does not say what is in it, and a model matching a
    weakness to an id needs to know what the id means.
    """
    by_unit: dict[str, list[str]] = {}
    for sid, meta in skill_catalogue().items():
        by_unit.setdefault(meta["unitTitle"], []).append(f"{sid} ({meta['title']})")
    return "\n".join(
        f"  {unit}: " + ", ".join(sorted(skills)) for unit, skills in sorted(by_unit.items())
    )


def resolve(topics: list[Any]) -> tuple[list[dict[str, Any]], list[str]]:
    """Validate the model's recommended topics against the real curriculum.

    Returns (routed, uncovered_topic_names).

    A skillId the model invented is treated as UNCOVERED rather than dropped.
    Dropping it would hide the fact that the interviewer is probing something the
    curriculum does not teach, which is exactly the signal worth keeping.
    """
    catalogue = skill_catalogue()
    routed: list[dict[str, Any]] = []
    uncovered: list[str] = []

    for raw in topics or []:
        if isinstance(raw, str):
            # Older reports, and any model that ignores the shape.
            topic, sid, why = raw, None, ""
        elif isinstance(raw, dict):
            topic = str(raw.get("topic") or "").strip()
            sid = raw.get("skillId") or None
            why = str(raw.get("why") or "").strip()
        else:
            continue
        if not topic:
            continue

        meta = catalogue.get(sid) if isinstance(sid, str) else None
        if meta:
            routed.append({
                "topic": topic,
                "why": why,
                "skillId": sid,
                "skillTitle": meta["title"],
                "unitId": meta["unitId"],
                "unitTitle": meta["unitTitle"],
                "covered": True,
            })
        else:
            routed.append({"topic": topic, "why": why, "skillId": None, "covered": False})
            uncovered.append(topic)

    return routed, uncovered
