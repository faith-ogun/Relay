"""Resilience primitives (#50): a dependency-free circuit breaker + a runner
that adds bounded retries and trips the breaker.

The point: when an upstream (Vertex/Gemini) is slow or down, we should fail fast
and recover automatically, not hang every request and pile up latency. Pair this
with a request timeout on the genai client (so a single call cannot hang); the
breaker then stops us from repeatedly waiting on a dependency that is timing out,
and lets callers degrade gracefully (fallback content, or a clean 503).

States: closed -> (fail_max consecutive failures) -> open -> (reset_timeout)
-> half-open -> success closes, failure re-opens.
"""

from __future__ import annotations

import logging
import time
from threading import Lock
from typing import Callable, TypeVar

logger = logging.getLogger("ohmlet.resilience")
T = TypeVar("T")


class CircuitOpenError(Exception):
    """Raised when a call is short-circuited because the breaker is open."""

    def __init__(self, name: str):
        super().__init__(f"circuit '{name}' is open")
        self.name = name


class CircuitBreaker:
    def __init__(self, name: str, fail_max: int = 5, reset_timeout: float = 30.0):
        self.name = name
        self.fail_max = fail_max
        self.reset_timeout = reset_timeout
        self._fails = 0
        self._opened_at: float | None = None
        self._lock = Lock()

    def allow(self) -> bool:
        """True if a call may proceed (closed or half-open), False if open."""
        with self._lock:
            if self._opened_at is None:
                return True
            if time.monotonic() - self._opened_at >= self.reset_timeout:
                return True  # half-open: let one trial call through
            return False

    def record_success(self) -> None:
        with self._lock:
            self._fails = 0
            self._opened_at = None

    def record_failure(self) -> None:
        with self._lock:
            self._fails += 1
            if self._fails >= self.fail_max and self._opened_at is None:
                logger.warning("circuit '%s' opened after %d consecutive failures", self.name, self._fails)
                self._opened_at = time.monotonic()
            elif self._opened_at is not None:
                self._opened_at = time.monotonic()  # half-open trial failed: stay open

    @property
    def state(self) -> str:
        with self._lock:
            if self._opened_at is None:
                return "closed"
            return "half-open" if time.monotonic() - self._opened_at >= self.reset_timeout else "open"


def run_resilient(fn: Callable[[], T], *, breaker: CircuitBreaker, retries: int = 0, backoff: float = 0.4) -> T:
    """Run fn behind the breaker with up to `retries` extra attempts.

    Raises CircuitOpenError immediately if the breaker is open. Otherwise runs
    fn; on the final failure it trips the breaker and re-raises the last error.
    """
    if not breaker.allow():
        raise CircuitOpenError(breaker.name)
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            out = fn()
            breaker.record_success()
            return out
        except Exception as exc:  # caller decides how to surface it
            last = exc
            if attempt < retries:
                time.sleep(backoff * (attempt + 1))
                continue
            breaker.record_failure()
            raise
    raise last  # unreachable, but keeps type-checkers happy
