"""3D generation providers (#31) — turn a photo of the finished build into a mesh.

The reporter produces the one post-session artifact: a real 3D digital twin of the
learner's completed build, generated from the final camera frame. True image→mesh
generation is a specialised model, so we call an external 3D-gen provider behind a
small adapter, and keep the rest of the service provider-agnostic.

Design:
  - `Provider.generate(image_png) -> glb_bytes` is the whole contract. A binary
    glTF (.glb) is the web-native, single-file 3D format our Three.js viewer loads.
  - The default adapter targets Stability AI's image-to-3D (Stable Fast 3D / SPAR3D),
    which returns a GLB in one synchronous call in a few seconds — simple and robust.
    Swappable via OHMLET_TWIN_PROVIDER; an async provider (Meshy/Tripo) can implement
    the same method by polling internally.
  - No key configured → `get_provider()` returns None and the service responds 503
    "twin generation isn't configured" rather than faking an artifact (no placeholders).

The API key is a real secret, injected from Secret Manager at deploy (never in code).
"""

from __future__ import annotations

import logging
import os
from typing import Optional, Protocol

import httpx

logger = logging.getLogger("ohmlet.reporter.providers")

# Generous client timeout: image→3D takes a few seconds, occasionally longer.
HTTP_TIMEOUT_S = float(os.getenv("OHMLET_TWIN_HTTP_TIMEOUT_S", "120"))


class TwinGenerationError(RuntimeError):
    """A provider failed to produce a mesh (network, quota, bad input)."""


class Provider(Protocol):
    name: str

    def generate(self, image_png: bytes) -> bytes:
        """Return GLB bytes for the given image, or raise TwinGenerationError."""
        ...


class StabilityProvider:
    """Stability AI image-to-3D. Returns a GLB directly.

    Endpoint + model are env-tunable so we can move between Stable Fast 3D and the
    point-aware model without a code change."""

    name = "stability"

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._url = os.getenv(
            "OHMLET_STABILITY_3D_URL",
            "https://api.stability.ai/v2beta/3d/stable-fast-3d",
        )

    def generate(self, image_png: bytes) -> bytes:
        headers = {"authorization": f"Bearer {self._api_key}", "accept": "model/gltf-binary"}
        files = {"image": ("build.png", image_png, "image/png")}
        # texture_resolution keeps the GLB light enough for a browser to stream.
        data = {"texture_resolution": os.getenv("OHMLET_TWIN_TEXTURE_RES", "1024")}
        try:
            with httpx.Client(timeout=HTTP_TIMEOUT_S) as client:
                resp = client.post(self._url, headers=headers, files=files, data=data)
        except httpx.HTTPError as exc:
            raise TwinGenerationError(f"3D provider unreachable: {exc}") from exc

        if resp.status_code == 200:
            body = resp.content
            if not body:
                raise TwinGenerationError("3D provider returned an empty model.")
            return body
        # Surface the provider's own reason where it's safe, without leaking secrets.
        detail = _safe_detail(resp)
        if resp.status_code in (402, 429):
            raise TwinGenerationError(f"3D provider over quota or rate limited ({resp.status_code}).")
        raise TwinGenerationError(f"3D provider error {resp.status_code}: {detail}")


def _safe_detail(resp: "httpx.Response") -> str:
    try:
        data = resp.json()
        if isinstance(data, dict):
            return str(data.get("message") or data.get("errors") or data.get("name") or "")[:200]
    except Exception:
        pass
    return (resp.text or "")[:200]


def get_provider() -> Optional[Provider]:
    """Build the configured provider, or None when no credentials are set.

    None is a first-class state: the feature is simply not configured in this
    environment, and the API returns a clean 503 instead of a fake twin."""
    choice = os.getenv("OHMLET_TWIN_PROVIDER", "stability").strip().lower()
    if choice in ("", "none", "disabled"):
        return None
    if choice == "stability":
        key = os.getenv("STABILITY_API_KEY", "").strip()
        if not key:
            logger.info("STABILITY_API_KEY not set — twin generation disabled.")
            return None
        return StabilityProvider(key)
    logger.warning("Unknown OHMLET_TWIN_PROVIDER=%s — twin generation disabled.", choice)
    return None
