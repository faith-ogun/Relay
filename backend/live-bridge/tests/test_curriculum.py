"""Curriculum endpoints (#70).

The curriculum moved from the client bundle to the backend so a lesson fix
reaches mobile without an App Store review. These tests pin the contract the
mobile cache depends on: a stable version stamp, a manifest that carries the
whole path, and per-lesson lookup by the authored (space-containing) id.
"""

import curriculum


def test_manifest_has_all_twelve_units():
    data = curriculum._curriculum()
    assert len(data["units"]) == 12
    assert data["version"]


def test_every_manifest_lesson_has_content():
    """The manifest must never advertise a lesson the content store lacks —
    that would render a path entry that 404s when tapped."""
    units = curriculum._curriculum()["units"]
    store = curriculum._lessons()["lessons"]
    ids = [
        lesson["id"]
        for unit in units
        for skill in unit.get("skills", [])
        for lesson in skill.get("lessons", [])
    ]
    # Not a hardcoded total. Splitting long sessions into parts changed the count
    # from 142 to 284 and this assertion went stale for days without anyone
    # noticing, which is worse than no canary at all. What actually matters is
    # that the manifest never advertises a lesson the store lacks, that no id is
    # served twice, and that the path has not been silently truncated.
    assert len(ids) >= 140, f"the path collapsed to {len(ids)} lessons"
    dupes = [i for i in set(ids) if ids.count(i) > 1]
    assert not dupes, f"the manifest lists the same lesson id more than once: {dupes[:5]}"
    missing = [i for i in ids if i not in store]
    assert not missing, f"manifest lists lessons with no content: {missing[:5]}"


def test_versions_agree_across_both_files():
    """Client caching keys off one version; if the two files disagree the cache
    can serve a manifest from one build against lessons from another."""
    assert curriculum._curriculum()["version"] == curriculum._lessons()["version"]
    assert curriculum.content_version() == curriculum._curriculum()["version"]


def test_lesson_ids_are_authored_strings_with_spaces():
    """Regression guard: ids are human-authored titles, not slugs. Anything that
    slugifies them (the mistake made once already with twin share ids) breaks
    every lesson lookup."""
    store = curriculum._lessons()["lessons"]
    assert any(" " in key for key in store), "expected authored ids containing spaces"


def test_lessons_carry_steps_and_xp():
    store = curriculum._lessons()["lessons"]
    sample = store["The Closed Loop"]
    assert sample["steps"], "lesson has no steps"
    assert sample["xpReward"] > 0


def test_achievement_catalogue_is_complete():
    """All 50 achievements must serve, each with the fields a client needs to
    render a card and decide whether it is earned."""
    data = curriculum._achievements()
    items = data["achievements"]
    assert len(items) == 50
    required = {"id", "title", "desc", "metric", "threshold", "tier"}
    for a in items:
        missing = required - set(a)
        assert not missing, f"{a.get('id')} missing {missing}"
    assert data["version"] == curriculum.content_version()


def test_achievement_ids_are_unique():
    ids = [a["id"] for a in curriculum._achievements()["achievements"]]
    assert len(ids) == len(set(ids))
