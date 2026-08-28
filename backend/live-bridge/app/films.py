"""Lesson films: short-lived signed URLs for a deliberately private bucket.

Forty three films sit in `gs://ohmlet-app-lessons` with public access prevention
ENFORCED, which was the right call and is also why nothing can play them yet:
there is no URL to hand a client.

Two ways out, and only one of them is defensible.

**Proxying the bytes through this service** would work and would be much worse.
A three minute film is 13 to 17MB, and streaming it through a FastAPI worker
charges vCPU-seconds and memory-seconds for the whole playback, pins a container
instance open per concurrent viewer, and puts video traffic in contention with
the live tutor's WebSockets on the same instances. It also caches nowhere.

**Signing** hands the client a short-lived URL and gets out of the way. GCS
serves the bytes, a CDN can be put in front later without changing this code,
and the private bucket stays private because the signature expires.

The URL is minted per request and lives 30 minutes: long enough for a three
minute film and a pause, short enough that a leaked link is worthless by the time
anyone finds it. Nothing is cached, because a cached signed URL is a signed URL
that outlives its reason to exist.

Signing without a key file: on Cloud Run the runtime service account has no
downloadable private key, and it must not. `generate_signed_url` can instead call
the IAM SignBlob API using the instance's own access token, which requires the
service account to hold `roles/iam.serviceAccountTokenCreator` ON ITSELF. That is
a one-line grant and it is recorded in ops/, because the failure it causes is a
403 at request time rather than at deploy time.
"""

from __future__ import annotations

import logging
import os
from datetime import timedelta
from functools import lru_cache
from typing import Any

logger = logging.getLogger("ohmlet.films")

FILMS_BUCKET = os.getenv("OHMLET_FILMS_BUCKET", "ohmlet-app-lessons")
FILMS_VERSION = os.getenv("OHMLET_FILMS_VERSION", "v1")
SIGNED_URL_MINUTES = int(os.getenv("OHMLET_FILM_URL_MINUTES", "30"))

# Films are addressed by SKILL id, which is what the app knows. The first two
# were published under their film ids and were moved, so this is true of all 43.
_SHAPES = {
    "phone": "phone-1080x1920",
    "web": "web-1920x1080",
}


@lru_cache(maxsize=1)
def _film_ids() -> frozenset[str]:
    """Skills that have a film, read from the curriculum rather than a list.

    A hand-kept list would drift the first time a film is added, and the failure
    would be a 404 on a checkpoint that visibly has a film everywhere else.
    """
    import curriculum

    try:
        data = curriculum._curriculum()
    except Exception as exc:
        logger.warning("curriculum unavailable for film index: %s", exc)
        return frozenset()
    # Review and gateway skills deliberately have no film: the boss covers them.
    return frozenset(
        s.get("id")
        for u in data.get("units", [])
        for s in u.get("skills", [])
        if s.get("id") and not s["id"].endswith(("-check", "-gateway"))
    )


def has_film(skill_id: str) -> bool:
    return skill_id in _film_ids()


def _signer():
    """A (client, service_account_email, access_token) triple for V4 signing."""
    import google.auth
    import google.auth.transport.requests
    from google.cloud import storage

    credentials, _ = google.auth.default()
    credentials.refresh(google.auth.transport.requests.Request())
    email = getattr(credentials, "service_account_email", None)
    token = getattr(credentials, "token", None)
    return storage.Client(), email, token


def _sign(client, email: str | None, token: str | None, path: str) -> str:
    blob = client.bucket(FILMS_BUCKET).blob(path)
    kwargs: dict[str, Any] = {
        "version": "v4",
        "expiration": timedelta(minutes=SIGNED_URL_MINUTES),
        "method": "GET",
    }
    # With a real key file (local development) neither of these is needed; on
    # Cloud Run both are, because there is no private key to sign with.
    if email and token:
        kwargs["service_account_email"] = email
        kwargs["access_token"] = token
    return blob.generate_signed_url(**kwargs)


def urls_for(skill_id: str) -> dict[str, Any]:
    """Signed URLs for one skill's film, in both shapes, plus poster and captions.

    Raises KeyError when the skill has no film, and RuntimeError when signing is
    not configured, so the caller can tell "no such film" from "we cannot serve
    films right now". Those are different answers and a learner deserves the
    right one.
    """
    if not has_film(skill_id):
        raise KeyError(skill_id)

    try:
        client, email, token = _signer()
    except Exception as exc:
        logger.error("film signing unavailable: %s", exc)
        raise RuntimeError("signing unavailable") from exc

    base = f"{FILMS_VERSION}/{skill_id}"
    out: dict[str, Any] = {
        "skillId": skill_id,
        "expiresInSeconds": SIGNED_URL_MINUTES * 60,
        "video": {},
        "poster": {},
    }
    for shape, suffix in _SHAPES.items():
        stem = f"ohmlet-lesson-{skill_id}-{suffix}"
        out["video"][shape] = _sign(client, email, token, f"{base}/{stem}.mp4")
        out["poster"][shape] = _sign(client, email, token, f"{base}/{stem}.jpg")
    out["captions"] = _sign(client, email, token, f"{base}/{skill_id}.vtt")
    return out
