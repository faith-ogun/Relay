"""Lesson film delivery: which skills have one, and how the URL is produced.

Forty three films sit in a bucket with public access prevention ENFORCED, which
is why nothing could play them: there was no URL to hand a client. Signing is the
answer, and proxying the bytes through this service is the wrong one. A three
minute film is 13 to 17MB; streaming that through a FastAPI worker charges CPU
and memory for the whole playback, pins an instance open per viewer, and puts
video in contention with the live tutor's WebSockets on the same instances.

What these pin:

  1. The film index comes from the CURRICULUM, not from a hand-kept list, so it
     cannot drift the first time a film is added.
  2. Review and gateway skills have no film. That is deliberate: the unit boss
     covers that ground, and a 404 there is the correct answer rather than a gap.
  3. A missing film and a broken signer are DIFFERENT failures. "There is no film
     for this skill" and "we cannot serve films right now" are different answers
     and a learner deserves the right one.
"""

from __future__ import annotations

import pytest

import films


def test_the_index_comes_from_the_curriculum():
    ids = films._film_ids()
    # Every unit in the authored curriculum contributes teaching skills.
    assert len(ids) >= 40, f"only {len(ids)} skills indexed"
    assert "circuits-current" in ids
    assert "rc-charging" in ids
    assert "driving-loads" in ids


def test_review_and_gateway_skills_have_no_film():
    """The boss covers a unit checkpoint, so a film there would be a second
    revision of the same ground. A 404 is the right answer, not a gap."""
    for sid in films._film_ids():
        assert not sid.endswith("-check"), sid
        assert not sid.endswith("-gateway"), sid
    assert films.has_film("foundations-check") is False
    assert films.has_film("analog-gateway") is False


def test_an_unknown_skill_has_no_film():
    assert films.has_film("not-a-skill") is False
    assert films.has_film("") is False


def test_a_missing_film_raises_KeyError_not_a_signing_error(monkeypatch):
    """The caller turns KeyError into 404 and RuntimeError into 503. Collapsing
    them would show 'films are unavailable' for a skill that simply has none."""
    with pytest.raises(KeyError):
        films.urls_for("foundations-check")


def test_a_broken_signer_raises_RuntimeError(monkeypatch):
    def boom():
        raise OSError("no credentials here")
    monkeypatch.setattr(films, "_signer", boom)
    with pytest.raises(RuntimeError):
        films.urls_for("circuits-current")


def test_every_shape_and_sidecar_is_addressed(monkeypatch):
    """Both cuts, both posters and the captions, at the published paths. The
    first two films were originally uploaded under their FILM ids rather than
    their skill ids and had to be moved; this is what stops that recurring."""
    seen: list[str] = []
    monkeypatch.setattr(films, "_signer", lambda: (None, "sa@example.com", "tok"))
    monkeypatch.setattr(films, "_sign", lambda c, e, t, path: (seen.append(path), f"https://signed/{path}")[1])

    out = films.urls_for("circuits-current")

    assert set(out["video"]) == {"phone", "web"}
    assert set(out["poster"]) == {"phone", "web"}
    assert out["captions"].endswith("circuits-current.vtt")
    assert out["expiresInSeconds"] == films.SIGNED_URL_MINUTES * 60

    # Addressed by SKILL id throughout, under the version prefix.
    assert all(p.startswith(f"{films.FILMS_VERSION}/circuits-current/") for p in seen), seen
    assert any(p.endswith("-phone-1080x1920.mp4") for p in seen)
    assert any(p.endswith("-web-1920x1080.mp4") for p in seen)
    assert len(seen) == 5, seen


def test_urls_are_short_lived():
    """A signed URL that outlives its reason to be short-lived is a public URL
    with extra steps. Thirty minutes covers a three minute film and a pause."""
    assert 5 <= films.SIGNED_URL_MINUTES <= 60


def test_the_film_index_says_what_is_in_the_bucket_not_what_ought_to_be():
    """It used to infer: not a review and not a gateway means it has a film.

    True on the day the films were rendered. Six skills were authored on
    2026-08-28 and it became false: the index claimed 49 films, the bucket held
    43, and Labs drew a play button on six skills whose film does not exist.
    Pressing it signed a URL for a missing object.

    The index reads the `hasFilm` stamp now, which the curriculum export takes
    from content/films.json, which sync-films.mjs generates from the bucket.
    """
    import json
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[3]
    manifest = set(json.loads((root / "content" / "films.json").read_text())["skills"])
    assert manifest, "the film manifest is empty, which would silently hide every film"

    assert set(films._film_ids()) == manifest, (
        "the served index and content/films.json disagree about which skills have a film"
    )


def test_a_skill_authored_without_a_film_is_not_offered_one():
    """The honest failure. A skill with no film gets no play button anywhere,
    rather than a play button that opens nothing."""
    import json
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[3]
    curriculum = json.loads(
        (pathlib.Path(__file__).resolve().parents[1] / "app" / "curriculum_data" / "curriculum.json").read_text()
    )
    manifest = set(json.loads((root / "content" / "films.json").read_text())["skills"])

    unfilmed = [
        s["id"]
        for u in curriculum["units"]
        for s in u["skills"]
        if s["id"] not in manifest
    ]
    for skill_id in unfilmed:
        assert not films.has_film(skill_id), (
            f"{skill_id} has no film in the bucket and the server would still sign a URL for one"
        )
