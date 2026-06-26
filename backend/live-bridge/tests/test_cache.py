"""TTL cache (#52) — correctness of hit/expiry/invalidation/eviction."""

import time

from cache import TTLCache


def test_caches_within_ttl_and_recomputes_after():
    calls = {"n": 0}

    def compute():
        calls["n"] += 1
        return calls["n"]

    c = TTLCache(ttl=0.05)
    assert c.get_or_compute("k", compute) == 1
    assert c.get_or_compute("k", compute) == 1  # cached, not recomputed
    assert calls["n"] == 1
    time.sleep(0.06)
    assert c.get_or_compute("k", compute) == 2  # expired → recomputed
    assert calls["n"] == 2


def test_invalidate_forces_recompute():
    calls = {"n": 0}

    def compute():
        calls["n"] += 1
        return calls["n"]

    c = TTLCache(ttl=60)
    assert c.get_or_compute("k", compute) == 1
    c.invalidate("k")
    assert c.get_or_compute("k", compute) == 2


def test_invalidate_prefix():
    c = TTLCache(ttl=60)
    c.get_or_compute("2026-W26", lambda: "a")
    c.get_or_compute("2026-W27", lambda: "b")
    c.invalidate_prefix("2026-W")
    recomputed = {"hit": False}

    def compute():
        recomputed["hit"] = True
        return "c"

    assert c.get_or_compute("2026-W26", compute) == "c"
    assert recomputed["hit"]


def test_eviction_bounds_size():
    c = TTLCache(ttl=60, max_entries=3)
    for i in range(5):
        c.get_or_compute(f"k{i}", lambda i=i: i)
        time.sleep(0.001)  # distinct timestamps so FIFO eviction is deterministic
    # Never exceeds the cap.
    assert len(c._store) <= 3
    # The most recent key is present.
    assert "k4" in c._store
