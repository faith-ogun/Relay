#!/usr/bin/env python3
"""Ask Vertex what this project can actually reach, instead of reading a docs page.

Two things this exists for.

gemini-2.5 retires 2026-10-16, inside the Shipaton judging window, and the live
tutor's voice model is a 2.5 model. As of 2026-08-27 no 3.x live/native-audio
model is reachable from this project in ANY region tested, so the migration is
blocked on Google publishing one. This finds it the day it lands.

And the availability that matters is per-project and per-region, which no
documentation states. Probed 2026-08-27:

    europe-west1  text: only gemini-2.5-*        live: gemini-live-2.5-flash-native-audio
    us-central1   text: (not probed)             live: gemini-live-2.5-flash-native-audio
    global        text: 2.5, 3.5, 3.6, 3.7 flash live: NOTHING

    Pro: gemini-3.1-pro-preview is the only 3.x Pro that answers, anywhere.

Run it:  ./.venv/bin/python scripts/probe_models.py
"""
import asyncio
import os
import sys

from google import genai
from google.genai import types

PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "ohmlet-app")

# Text and reasoning models, checked with a one-token generate.
TEXT_CANDIDATES = [
    "gemini-2.5-flash", "gemini-2.5-pro",
    "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash",
    "gemini-3.1-pro-preview", "gemini-3.1-pro", "gemini-3.5-pro", "gemini-3.7-pro",
]

# Live models. A bidi model cannot be checked with generateContent: it returns
# the same 404 whether it exists or not, INCLUDING the one in production. The
# only honest test is opening a session.
LIVE_CANDIDATES = [
    "gemini-live-2.5-flash-native-audio",
    "gemini-live-3.1-flash-native-audio", "gemini-live-3.5-flash-native-audio",
    "gemini-live-3.7-flash-native-audio", "gemini-live-4.0-flash-native-audio",
    "gemini-3.1-flash-live-preview", "gemini-3.5-flash-live-preview",
    "gemini-3.7-flash-live-preview",
]

LOCATIONS = ["europe-west1", "us-central1", "global"]


def probe_text(client, model: str) -> str:
    try:
        client.models.generate_content(
            model=model,
            contents="hi",
            config=types.GenerateContentConfig(max_output_tokens=1),
        )
        return "OK"
    except Exception as exc:  # noqa: BLE001 - any failure means unreachable
        return "no" if "not found" in str(exc).lower() else f"err {str(exc)[:40]}"


async def probe_live(client, model: str) -> str:
    cfg = types.LiveConnectConfig(response_modalities=["AUDIO"])
    try:
        async with asyncio.timeout(20):
            async with client.aio.live.connect(model=model, config=cfg):
                return "OK"
    except asyncio.TimeoutError:
        return "timeout"
    except Exception as exc:  # noqa: BLE001
        s = str(exc).lower()
        return "no" if "not found" in s or "not supported" in s else f"err {str(exc)[:40]}"


async def main() -> int:
    found_live_successor = False
    for loc in LOCATIONS:
        print(f"\n=== {loc} ===")
        client = genai.Client(vertexai=True, project=PROJECT, location=loc)

        print("  text:")
        for m in TEXT_CANDIDATES:
            r = probe_text(client, m)
            if r == "OK":
                print(f"    {m:32s} OK")

        print("  live:")
        for m in LIVE_CANDIDATES:
            r = await probe_live(client, m)
            if r == "OK":
                print(f"    {m:32s} OK")
                if "2.5" not in m:
                    found_live_successor = True

    print()
    if found_live_successor:
        print("A live model newer than 2.5 is now reachable. Migrate OHMLET_LIVE_MODEL to it,")
        print("then re-run mobile/scripts/check-model-currency.mjs.")
        return 0
    print("No live model newer than 2.5 is reachable yet. The live tutor's voice is still")
    print("blocked on Google publishing one. gemini-2.5 retires 2026-10-16.")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
