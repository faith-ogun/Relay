"""In-process TTL cache (#52).

A tiny, dependency-free, thread-safe cache for read-heavy computations whose
result is shared across users and tolerates a few seconds of staleness — e.g. the
weekly league's top-100, which is identical for everyone and otherwise costs a
Firestore query + sort on every request.

Scope and trade-offs (deliberate):
  - Per-instance. Cloud Run may run several instances, each with its own cache, so
    a value can be up to `ttl` seconds stale per instance. That is fine for the
    things we cache here (leaderboards, public lists) and avoids the operational
    weight of a shared Redis for launch scale. Never cache per-user private data
    or anything that must be read-your-writes consistent without explicit
    invalidation.
  - Active invalidation. Writers that change a cached value call `invalidate(key)`
    (or `invalidate_prefix`) so a user sees their own change immediately, rather
    than waiting out the TTL.

For per-instance memory safety the store is capped; the oldest entries are
evicted first (FIFO) when the cap is exceeded.
"""

from __future__ import annotations

import time
from threading import Lock
from typing import Callable, Dict, Tuple, TypeVar

T = TypeVar("T")


class TTLCache:
    def __init__(self, ttl: float, max_entries: int = 512) -> None:
        self._ttl = ttl
        self._max = max_entries
        self._store: Dict[str, Tuple[float, object]] = {}
        self._lock = Lock()

    def get_or_compute(self, key: str, compute: Callable[[], T]) -> T:
        """Return the cached value for `key`, or compute, store, and return it.

        `compute` runs outside the lock so a slow producer never blocks readers of
        *other* keys. A small race where two callers compute the same cold key
        concurrently is harmless (last write wins; values are equivalent)."""
        now = time.monotonic()
        with self._lock:
            hit = self._store.get(key)
            if hit is not None and now - hit[0] < self._ttl:
                return hit[1]  # type: ignore[return-value]

        value = compute()

        with self._lock:
            if key not in self._store and len(self._store) >= self._max:
                # Evict the oldest entry (FIFO) to bound memory.
                oldest = min(self._store, key=lambda k: self._store[k][0])
                self._store.pop(oldest, None)
            self._store[key] = (now, value)
        return value

    def invalidate(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        with self._lock:
            for k in [k for k in self._store if k.startswith(prefix)]:
                self._store.pop(k, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
