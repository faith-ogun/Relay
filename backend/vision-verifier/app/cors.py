"""CORS policy (#35 hardening) — shared, identical across services.

The old config was `allow_origins=["*"]` with `allow_credentials=True`, which is
both spec-invalid (browsers reject credentialed wildcard) and needlessly open.
Ohmlet authenticates with a Firebase ID token in the `Authorization` header, not
cookies, so credentials are not needed cross-origin — we set them off and instead
scope the allowed origins to Ohmlet's own surfaces (prod, Firebase Hosting +
preview channels, and localhost dev). Everything is env-overridable:

  OHMLET_ALLOWED_ORIGINS="*"                         → allow all (credentials off)
  OHMLET_ALLOWED_ORIGINS="https://a.com,https://b.com" → explicit allowlist
  (unset)                                            → the default Ohmlet regex

Duplicated per service the same way resilience.py is; keep the copies in sync.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ohmlet's own web origins: ohmlet.org (+ www), Firebase Hosting on web.app
# (including `--preview` channels) and firebaseapp.com, plus localhost for dev.
DEFAULT_ORIGIN_REGEX = (
    r"^(https://((www\.)?ohmlet\.org"
    r"|ohmlet-app(--[a-z0-9-]+)?\.web\.app"
    r"|ohmlet-app\.firebaseapp\.com)"
    r"|http://(localhost|127\.0\.0\.1)(:\d+)?)$"
)


def install_cors(app: FastAPI) -> None:
    common = dict(
        allow_credentials=False,  # Bearer-token auth; no cross-origin cookies
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id"],
        max_age=3600,
    )
    configured = os.getenv("OHMLET_ALLOWED_ORIGINS", "").strip()
    if configured == "*":
        app.add_middleware(CORSMiddleware, allow_origins=["*"], **common)
    elif configured:
        origins = [o.strip() for o in configured.split(",") if o.strip()]
        app.add_middleware(CORSMiddleware, allow_origins=origins, **common)
    else:
        app.add_middleware(CORSMiddleware, allow_origin_regex=DEFAULT_ORIGIN_REGEX, **common)
