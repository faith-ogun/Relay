"""Rate limiting + abuse prevention (#47).

A lightweight, dependency-free limiter for the live-bridge. Two layers:

  1. A per-identity sliding-window cap on REST calls (state reads/writes, /v1/me,
     plan changes), keyed by the verified UID when present, else the client IP.
  2. A per-identity cap on new live WebSocket sessions per minute, so nobody can
     hammer the expensive Gemini path open/closed in a loop.

In-memory and per-instance: it is the first and cheapest line of defence (it
blunts a single misbehaving client immediately). It is NOT a distributed quota —
that, plus edge protection, is a later hardening step; the daily live BUDGET in
entitlements.py is the real cross-instance spend cap. Cloud Run can run multiple
instances, so treat these numbers as per-instance ceilings.

All limits are env-tunable so they can be tightened without a code change.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

# REST: max requests per window per identity.
_REST_MAX = int(os.getenv("OHMLET_RL_REST_MAX", "120"))
_REST_WINDOW = float(os.getenv("OHMLET_RL_REST_WINDOW_SEC", "60"))

# Live WS: max new sessions per window per identity.
_WS_MAX = int(os.getenv("OHMLET_RL_WS_MAX", "8"))
_WS_WINDOW = float(os.getenv("OHMLET_RL_WS_WINDOW_SEC", "60"))

_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def _client_ip(request: Request) -> str:
    """Best-effort client IP. Behind Cloud Run / a proxy, the first hop in
    X-Forwarded-For is the real client; fall back to the socket peer."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check(bucket_key: str, max_hits: int, window: float) -> bool:
    """Sliding-window check. Returns True if allowed, False if over the limit."""
    now = time.monotonic()
    with _lock:
        q = _hits[bucket_key]
        cutoff = now - window
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= max_hits:
            return False
        q.append(now)
        return True


def enforce_rest(request: Request, identity: str | None = None) -> None:
    """Raise 429 if this identity has exceeded the REST limit."""
    key = f"rest:{identity or _client_ip(request)}"
    if not _check(key, _REST_MAX, _REST_WINDOW):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down and try again shortly.",
            headers={"Retry-After": str(int(_REST_WINDOW))},
        )


def allow_ws_session(identity: str) -> bool:
    """True if this identity may open another live session right now."""
    return _check(f"ws:{identity}", _WS_MAX, _WS_WINDOW)
