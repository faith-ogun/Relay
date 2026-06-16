"""Per-session usage metering for the live tutor.

The live multimodal tutor has real marginal cost: every active minute streams
Gemini tokens (audio in/out, video frames). Unlike Duolingo/Brilliant, serving
an extra active user is NOT free, so we must know our cost-per-tutor-hour before
we can price or cap intelligently. (See the strategy decisions: measure first.)

Each WebSocket session owns a UsageMeter that accumulates raw counters and, on
close, writes one record to Firestore (collection `usage_sessions`). Real cost
can then be computed from billing; the estimate here is a consistent internal
signal, not a billing source of truth.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("ohmlet.usage")

# Upstream audio is PCM 16-bit mono @ 16kHz => 32000 bytes/sec.
_AUDIO_IN_BYTES_PER_SEC = 16000 * 2

# Coarse cost estimate (USD), overridable via env. Defaults reflect ballpark
# Gemini Live pricing; refine once real billing data lands. The raw counters
# below are the source of truth, the estimate is just a live signal.
_RATE_AUDIO_MIN = float(os.getenv("OHMLET_RATE_AUDIO_MIN_USD", "0.037"))
_RATE_VIDEO_FRAME = float(os.getenv("OHMLET_RATE_VIDEO_FRAME_USD", "0.0002"))
_RATE_PER_1K_TOKENS = float(os.getenv("OHMLET_RATE_PER_1K_TOKENS_USD", "0.0"))


@dataclass
class UsageMeter:
    user_id: str
    session_id: str
    _t0: float = field(default_factory=time.monotonic)
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    audio_in_bytes: int = 0
    image_frames: int = 0
    text_msgs: int = 0
    events_out: int = 0
    prompt_tokens: int = 0
    response_tokens: int = 0
    total_tokens: int = 0
    _last_activity: float = field(default_factory=time.monotonic)

    # ── recording ──
    def on_audio_in(self, n_bytes: int) -> None:
        self.audio_in_bytes += n_bytes
        self.touch()

    def on_image(self) -> None:
        self.image_frames += 1
        self.touch()

    def on_text(self) -> None:
        self.text_msgs += 1
        self.touch()

    def on_event(self, event: Any) -> None:
        """Accumulate token usage from an ADK/Gemini event, defensively."""
        self.events_out += 1
        meta = getattr(event, "usage_metadata", None)
        if meta is not None:
            self.prompt_tokens += int(getattr(meta, "prompt_token_count", 0) or 0)
            self.response_tokens += int(getattr(meta, "candidates_token_count", 0) or 0)
            total = getattr(meta, "total_token_count", 0) or 0
            self.total_tokens += int(total)

    def touch(self) -> None:
        self._last_activity = time.monotonic()

    # ── derived ──
    def idle_seconds(self) -> float:
        return time.monotonic() - self._last_activity

    def duration_seconds(self) -> float:
        return time.monotonic() - self._t0

    def audio_in_seconds(self) -> float:
        return self.audio_in_bytes / _AUDIO_IN_BYTES_PER_SEC

    def estimated_cost_usd(self) -> float:
        cost = (self.audio_in_seconds() / 60.0) * _RATE_AUDIO_MIN
        cost += self.image_frames * _RATE_VIDEO_FRAME
        cost += (self.total_tokens / 1000.0) * _RATE_PER_1K_TOKENS
        return round(cost, 6)

    def summary(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "session_id": self.session_id,
            "started_at": self.started_at,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": round(self.duration_seconds(), 1),
            "audio_in_seconds": round(self.audio_in_seconds(), 1),
            "image_frames": self.image_frames,
            "text_msgs": self.text_msgs,
            "events_out": self.events_out,
            "prompt_tokens": self.prompt_tokens,
            "response_tokens": self.response_tokens,
            "total_tokens": self.total_tokens,
            "estimated_cost_usd": self.estimated_cost_usd(),
        }


def persist_usage(meter: UsageMeter) -> None:
    """Log the session summary and write it to Firestore (best-effort)."""
    record = meter.summary()
    logger.info("session usage: %s", record)
    try:
        from state_store import get_client

        get_client().collection(
            os.getenv("OHMLET_USAGE_COLLECTION", "usage_sessions")
        ).document(f"{meter.session_id}-{int(time.time())}").set(record)
    except Exception as exc:  # never let metering break a session
        logger.warning("usage persist failed for %s: %s", meter.session_id, exc)
