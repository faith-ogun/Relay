"""Resilience primitives (#50) — circuit breaker + resilient runner."""

import pytest

from resilience import CircuitBreaker, CircuitOpenError, run_resilient


def test_breaker_opens_after_fail_max():
    cb = CircuitBreaker("t", fail_max=3, reset_timeout=60)
    assert cb.allow() and cb.state == "closed"
    for _ in range(3):
        cb.record_failure()
    assert cb.state == "open"
    assert cb.allow() is False  # short-circuits while open


def test_breaker_success_resets():
    cb = CircuitBreaker("t", fail_max=2, reset_timeout=60)
    cb.record_failure()
    cb.record_success()
    cb.record_failure()  # only 1 consecutive now, still closed
    assert cb.state == "closed"
    assert cb.allow() is True


def test_breaker_half_opens_after_cooldown():
    cb = CircuitBreaker("t", fail_max=1, reset_timeout=0.05)
    cb.record_failure()
    assert cb.allow() is False  # open
    import time
    time.sleep(0.06)
    assert cb.allow() is True  # half-open: trial allowed
    assert cb.state == "half-open"
    cb.record_success()
    assert cb.state == "closed"


def test_run_resilient_short_circuits_when_open():
    cb = CircuitBreaker("t", fail_max=1, reset_timeout=60)
    cb.record_failure()  # open
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        return "ok"

    with pytest.raises(CircuitOpenError):
        run_resilient(fn, breaker=cb)
    assert calls["n"] == 0  # never called the downstream


def test_run_resilient_retries_then_trips():
    cb = CircuitBreaker("t", fail_max=1, reset_timeout=60)
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        run_resilient(fn, breaker=cb, retries=2, backoff=0.0)
    assert calls["n"] == 3  # initial + 2 retries
    assert cb.state == "open"  # tripped after exhausting retries


def test_run_resilient_returns_on_success():
    cb = CircuitBreaker("t", fail_max=2, reset_timeout=60)
    assert run_resilient(lambda: 42, breaker=cb) == 42
    assert cb.state == "closed"


# ── breaker.call() ──
# Regression guard: three production call sites (the 3D-twin generator and both
# interview endpoints) invoke `breaker.call(fn, *args)`. The method was missing
# for months, so every one of those calls raised AttributeError, was swallowed
# by a broad `except Exception`, and surfaced as a 502/503. The feature never
# worked. These tests fail loudly if the method is ever dropped again.
def test_breaker_call_exists_and_passes_through_args():
    cb = CircuitBreaker("t", fail_max=2, reset_timeout=60)
    assert hasattr(cb, "call"), "CircuitBreaker.call is used by reporter + interview_router"
    assert cb.call(lambda a, b=0: a + b, 40, b=2) == 42
    assert cb.state == "closed"


def test_breaker_call_records_failures_and_short_circuits():
    cb = CircuitBreaker("t", fail_max=2, reset_timeout=60)

    def boom():
        raise RuntimeError("boom")

    for _ in range(2):
        with pytest.raises(RuntimeError):
            cb.call(boom)
    assert cb.state == "open"

    # Once open, further calls short-circuit instead of hitting the upstream.
    with pytest.raises(CircuitOpenError):
        cb.call(lambda: "should not run")
