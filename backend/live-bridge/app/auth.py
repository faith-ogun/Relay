"""Server-side identity: verify the Firebase ID token, derive the UID here.

This is the teeth behind per-user isolation (#44). The browser signs in with
Firebase Auth and sends its short-lived ID token; the backend verifies that
token with the Firebase Admin SDK and derives the user's UID *itself*. Nothing
the client claims about who it is (a path param, a payload field) is trusted —
only the cryptographically verified token.

Admin SDK credentials resolve via Application Default Credentials: the Cloud Run
service account in production, `gcloud auth application-default login` locally.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import Header, HTTPException, status

logger = logging.getLogger("ohmlet.auth")

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "ohmlet-app")

ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.getenv("OHMLET_ADMIN_EMAILS", "faithogun12@gmail.com,hello@ohmlet.org").split(",")
    if e.strip()
}


@lru_cache(maxsize=1)
def _ensure_app() -> bool:
    """Initialise the Firebase Admin app once (idempotent across workers)."""
    if not firebase_admin._apps:
        firebase_admin.initialize_app(options={"projectId": PROJECT_ID})
    return True


def verify_id_token(token: str) -> dict:
    """Verify a Firebase ID token and return its decoded claims, or raise 401."""
    _ensure_app()
    if not token or not token.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
    try:
        return firebase_auth.verify_id_token(token.strip())
    except Exception as exc:  # invalid signature, expired, revoked, wrong project
        logger.warning("ID token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired credentials"
        ) from exc


def uid_from_bearer(authorization: str | None) -> str:
    """Pull the bearer token out of an Authorization header and return its UID."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return verify_id_token(authorization.split(" ", 1)[1])["uid"]


def is_admin(decoded: dict) -> bool:
    """Owner allowlist for now; hardens to a custom claim later (#56)."""
    email = (decoded.get("email") or "").lower()
    return bool(decoded.get("admin")) or email in ADMIN_EMAILS


# ── FastAPI dependency ──
def require_uid(authorization: str | None = Header(default=None)) -> str:
    """Dependency that yields the verified UID for the current request."""
    return uid_from_bearer(authorization)
