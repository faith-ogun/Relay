"""Observability + production hardening (#35) — shared across every Ohmlet service.

One dependency-free module (stdlib only) that drops into each Cloud Run service
unchanged, so the operational surface is identical everywhere:

  1. Structured JSON logging to stdout. Cloud Logging parses JSON on stdout and
     promotes special fields: `severity`, `logging.googleapis.com/trace`,
     `logging.googleapis.com/spanId`. We populate the trace from the inbound
     `X-Cloud-Trace-Context` header so every log line for a request links to its
     trace in Cloud Trace — that is "tracing" without a heavyweight agent.
  2. A request middleware that times every call, assigns a request id, records
     in-process metrics, sets security headers, and converts any unhandled
     exception into a clean JSON 500 (a request id, never an internal stack).
  3. A token-guarded `/internal/metrics` endpoint (counts, latency p50/p95,
     error rate per route, uptime, circuit-breaker states) for scraping/debug.
  4. A security audit trail: `audit()` emits an immutable structured log line
     (durable, queryable, exportable to BigQuery) and, where a sink is
     registered, also persists to Firestore for an in-app admin view.

Because each Cloud Run service deploys from its own source dir, this file is
duplicated verbatim per service (the same way resilience.py is). Keep the copies
identical; edit one, copy to the rest.
"""

from __future__ import annotations

import contextvars
import json
import logging
import os
import re
import sys
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Callable

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "ohmlet-app")
LOG_LEVEL = os.getenv("OHMLET_LOG_LEVEL", "INFO").upper()

# ── Per-request correlation (contextvars survive across awaits) ──
_request_id: contextvars.ContextVar[str] = contextvars.ContextVar("ohmlet_request_id", default="")
_trace: contextvars.ContextVar[str] = contextvars.ContextVar("ohmlet_trace", default="")
_span: contextvars.ContextVar[str] = contextvars.ContextVar("ohmlet_span", default="")
_uid: contextvars.ContextVar[str] = contextvars.ContextVar("ohmlet_uid", default="")

_SEVERITY = {10: "DEBUG", 20: "INFO", 30: "WARNING", 40: "ERROR", 50: "CRITICAL"}


# ── Structured logging ───────────────────────────────────────────────────────


class StructuredFormatter(logging.Formatter):
    """Render each record as a single-line JSON object Cloud Logging understands."""

    def __init__(self, service: str):
        super().__init__()
        self.service = service

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "severity": _SEVERITY.get(record.levelno, "DEFAULT"),
            "message": record.getMessage(),
            "service": self.service,
            "logger": record.name,
            "time": datetime.now(timezone.utc).isoformat(),
        }
        rid = _request_id.get()
        if rid:
            entry["requestId"] = rid
        trace = _trace.get()
        if trace:
            entry["logging.googleapis.com/trace"] = f"projects/{PROJECT_ID}/traces/{trace}"
        span = _span.get()
        if span:
            entry["logging.googleapis.com/spanId"] = span
        uid = _uid.get()
        if uid:
            entry["uid"] = uid
        # Structured extras: logger.info(..., extra={"json_fields": {...}})
        extra = getattr(record, "json_fields", None)
        if isinstance(extra, dict):
            entry.update(extra)
        if record.exc_info:
            entry["stack"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def configure_logging(service: str) -> None:
    """Point the root logger (and uvicorn's) at the structured JSON formatter."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter(service))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(LOG_LEVEL)
    # Route uvicorn's own loggers through the same handler so the whole stream is
    # structured (and silence the chatty per-request access log; we emit our own).
    for name in ("uvicorn", "uvicorn.error"):
        lg = logging.getLogger(name)
        lg.handlers[:] = [handler]
        lg.propagate = False
    logging.getLogger("uvicorn.access").handlers[:] = []
    logging.getLogger("uvicorn.access").propagate = False


# ── Metrics registry (in-process, per-instance) ───────────────────────────────


class _Metrics:
    """Lightweight thread-safe counters + per-route latency reservoirs.

    Cloud Run already reports request counts/latencies at the platform level;
    this adds *application* signal (latency percentiles per logical route, error
    rate, custom counters like AI calls / circuit trips) that the platform can't
    see, exposed for a quick scrape without standing up a metrics backend.
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._counters: dict[str, int] = {}
        self._routes: dict[str, dict[str, Any]] = {}
        self._breakers: dict[str, Any] = {}
        self._started = time.time()

    def inc(self, name: str, n: int = 1) -> None:
        with self._lock:
            self._counters[name] = self._counters.get(name, 0) + n

    def observe_request(self, method: str, route: str, status: int, latency_ms: float) -> None:
        key = f"{method} {route}"
        with self._lock:
            r = self._routes.get(key)
            if r is None:
                r = {"count": 0, "errors": 0, "client_errors": 0, "lat_sum": 0.0, "lat_max": 0.0, "recent": deque(maxlen=256)}
                self._routes[key] = r
            r["count"] += 1
            if status >= 500:
                r["errors"] += 1
            elif status >= 400:
                r["client_errors"] += 1
            r["lat_sum"] += latency_ms
            r["lat_max"] = max(r["lat_max"], latency_ms)
            r["recent"].append(latency_ms)

    def register_breaker(self, name: str, breaker: Any) -> None:
        with self._lock:
            self._breakers[name] = breaker

    @staticmethod
    def _pct(values: list[float], q: float) -> float:
        if not values:
            return 0.0
        s = sorted(values)
        idx = min(len(s) - 1, int(q * len(s)))
        return round(s[idx], 1)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            routes = {}
            total = 0
            errors = 0
            for key, r in self._routes.items():
                recent = list(r["recent"])
                total += r["count"]
                errors += r["errors"]
                routes[key] = {
                    "count": r["count"],
                    "errors": r["errors"],
                    "clientErrors": r["client_errors"],
                    "avgMs": round(r["lat_sum"] / r["count"], 1) if r["count"] else 0.0,
                    "p50Ms": self._pct(recent, 0.50),
                    "p95Ms": self._pct(recent, 0.95),
                    "maxMs": round(r["lat_max"], 1),
                }
            breakers = {name: getattr(b, "state", "unknown") for name, b in self._breakers.items()}
            return {
                "uptimeSeconds": round(time.time() - self._started, 1),
                "totals": {"requests": total, "serverErrors": errors},
                "counters": dict(self._counters),
                "routes": routes,
                "circuitBreakers": breakers,
            }


metrics = _Metrics()


# ── Trace context + correlation helpers ───────────────────────────────────────


def _set_trace_from_header(value: str | None) -> None:
    """Parse `X-Cloud-Trace-Context: TRACE_ID/SPAN_ID;o=1` for log correlation."""
    if not value:
        _trace.set("")
        _span.set("")
        return
    trace_id = value.split("/", 1)[0].strip()
    _trace.set(trace_id)
    span = ""
    if "/" in value:
        span = value.split("/", 1)[1].split(";", 1)[0].strip()
    _span.set(span)


def set_uid(uid: str | None) -> None:
    """Bind the verified UID to this request so logs + audit lines carry it."""
    _uid.set(uid or "")


def current_request_id() -> str:
    return _request_id.get()


_ID_SEG = re.compile(r"^(?:[0-9]+|[0-9a-fA-F-]{12,}|[A-Za-z0-9_-]{20,})$")


def _collapse(path: str) -> str:
    """Collapse id-like path segments so metrics don't explode in cardinality."""
    parts = [(":id" if _ID_SEG.match(seg) else seg) for seg in path.split("/")]
    return "/".join(parts) or "/"


def _route_label(request: Request) -> str:
    route = request.scope.get("route")
    tpl = getattr(route, "path", None)
    return tpl if tpl else _collapse(request.url.path)


# ── Security headers ───────────────────────────────────────────────────────────

_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY",
}


def _apply_headers(response: Any, rid: str) -> None:
    try:
        for k, v in _SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        response.headers["X-Request-Id"] = rid
    except Exception:
        pass


# ── Audit trail ────────────────────────────────────────────────────────────────

_audit_sink: Callable[[dict[str, Any]], None] | None = None


def register_audit_sink(fn: Callable[[dict[str, Any]], None]) -> None:
    """Register a durable sink (e.g. Firestore) for audit records, in addition to
    the structured log line that is always emitted."""
    global _audit_sink
    _audit_sink = fn


def audit(event: str, *, uid: str | None = None, **fields: Any) -> None:
    """Emit a security/compliance audit record.

    Always logs a structured line (Cloud Logging is the durable, immutable,
    exportable audit sink). If a sink is registered it is also persisted there,
    best-effort — auditing must never break the action it records.
    """
    record = {
        "audit": True,
        "event": event,
        "uid": uid or _uid.get() or None,
        "requestId": _request_id.get() or None,
        "at": datetime.now(timezone.utc).isoformat(),
        **fields,
    }
    logging.getLogger("ohmlet.audit").info("audit:%s", event, extra={"json_fields": record})
    if _audit_sink is not None:
        try:
            _audit_sink(record)
        except Exception as exc:  # never let auditing break the request
            logging.getLogger("ohmlet.audit").warning("audit sink failed for %s: %s", event, exc)


# ── Wiring it all into a FastAPI app ──────────────────────────────────────────


def install_observability(app: FastAPI, service: str) -> None:
    """Configure logging and attach the request middleware + metrics endpoint.

    Call once, after the app and any other middlewares are created. The middleware
    added here runs outermost, so it times the entire request and is the final
    backstop that converts an unhandled error into a clean JSON 500.
    """
    configure_logging(service)
    access_log = logging.getLogger(f"ohmlet.{service}.access")
    err_log = logging.getLogger(f"ohmlet.{service}")

    quiet_paths = {"/health", "/healthz", "/internal/metrics", "/"}

    @app.middleware("http")
    async def _observe(request: Request, call_next):
        rid = uuid.uuid4().hex[:16]
        _request_id.set(rid)
        _uid.set("")
        _set_trace_from_header(request.headers.get("x-cloud-trace-context"))
        t0 = time.monotonic()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            _apply_headers(response, rid)
            return response
        except Exception:
            err_log.exception("unhandled error", extra={"json_fields": {"path": request.url.path, "method": request.method}})
            metrics.inc("unhandled_exceptions")
            resp = JSONResponse(
                status_code=500,
                content={"detail": "Something went wrong on our end. Please try again.", "requestId": rid},
            )
            _apply_headers(resp, rid)
            status = 500
            return resp
        finally:
            dt_ms = (time.monotonic() - t0) * 1000.0
            route = _route_label(request)
            metrics.observe_request(request.method, route, status, dt_ms)
            if request.url.path not in quiet_paths:
                access_log.info(
                    "request",
                    extra={
                        "json_fields": {
                            "httpRequest": {
                                "requestMethod": request.method,
                                "requestUrl": str(request.url),
                                "status": status,
                                "userAgent": request.headers.get("user-agent"),
                                "remoteIp": (request.headers.get("x-forwarded-for", "").split(",")[0].strip() or None),
                                "latency": f"{dt_ms / 1000.0:.3f}s",
                            },
                            "route": route,
                            "status": status,
                            "latencyMs": round(dt_ms, 1),
                        }
                    },
                )

    metrics_token = os.getenv("OHMLET_METRICS_TOKEN", "")

    @app.get("/internal/metrics", include_in_schema=False)
    def _metrics_endpoint(x_ohmlet_metrics_token: str | None = Header(default=None)) -> dict[str, Any]:
        # 404 (not 401/403) when unconfigured or wrong, so the endpoint's very
        # existence isn't advertised to an unauthenticated scanner.
        if not metrics_token or x_ohmlet_metrics_token != metrics_token:
            raise HTTPException(status_code=404, detail="Not found")
        return metrics.snapshot()

    err_log.info("observability installed", extra={"json_fields": {"service": service}})
