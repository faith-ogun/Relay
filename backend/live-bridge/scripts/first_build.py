#!/usr/bin/env python3
"""Does 60 free minutes cover one real first build?

The entire free tier rests on that assumption and nobody has ever checked it.
Session duration has been instrumented since usage_meter.py existed, but no
production session has been recorded, so the number is a guess wearing a
comment.

This reads what the meter actually wrote and answers three questions:

  1. How long is a real session, and how long is a learner's FIRST session?
  2. How often does a free learner get cut off mid-session, which is the bad
     failure: the tutor stops talking while they are holding a wire.
  3. What would the cap need to be to cover the 90th percentile first session?

Run it against production:

    OHMLET_STATE_PROJECT=ohmlet-app PYTHONPATH=app python3 scripts/first_build.py

It exits 1 if free learners are being cut off more than RARE_PCT of the time,
so it can be wired into a weekly check rather than remembered.
"""

from __future__ import annotations

import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app"))

USAGE_COLLECTION = os.getenv("OHMLET_USAGE_COLLECTION", "usage_sessions")
FREE_CAP_MIN = float(os.getenv("OHMLET_LIVE_MIN_FREE", "60"))
# Above this share of free sessions ending in a cutoff, the cap is too tight to
# defend. One in twenty is a stretch; one in ten is a broken free tier.
RARE_PCT = float(os.getenv("OHMLET_CUTOFF_ALERT_PCT", "10"))


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    i = min(len(s) - 1, max(0, int(round((p / 100.0) * (len(s) - 1)))))
    return s[i]


def main() -> int:
    from google.cloud import firestore

    client = firestore.Client(project=os.getenv("OHMLET_STATE_PROJECT") or None)
    docs = list(client.collection(USAGE_COLLECTION).stream())

    if not docs:
        print("No sessions recorded yet.")
        print()
        print("  This is the honest answer, not a failure: the free tier's")
        print("  60 minute cap has never been tested against a real learner.")
        print("  Until somebody completes a build, the number is an assumption.")
        return 0

    per_user: dict[str, list[dict]] = defaultdict(list)
    for d in docs:
        row = d.to_dict() or {}
        uid = row.get("user_id")
        if uid:
            per_user[uid].append(row)

    all_mins: list[float] = []
    first_mins: list[float] = []
    for uid, rows in per_user.items():
        rows.sort(key=lambda r: r.get("started_at") or "")
        for r in rows:
            all_mins.append(float(r.get("duration_seconds") or 0) / 60.0)
        first_mins.append(float(rows[0].get("duration_seconds") or 0) / 60.0)

    print(f"{len(docs)} sessions from {len(per_user)} learners\n")
    print(f"{'':22}{'p50':>8}{'p90':>8}{'p99':>8}{'max':>8}")
    for label, vals in (("every session (min)", all_mins), ("FIRST session (min)", first_mins)):
        print(f"  {label:<20}{pct(vals,50):>8.1f}{pct(vals,90):>8.1f}{pct(vals,99):>8.1f}{max(vals):>8.1f}")

    p90_first = pct(first_mins, 90)
    print()

    # A percentile over a handful of sessions from one person is arithmetic, not
    # evidence. Say so, rather than printing a confident number off nine test
    # connections and letting somebody price a tier on it.
    MIN_LEARNERS, MIN_SESSIONS, REAL_BUILD_MIN = 20, 50, 5.0
    real = [m for m in first_mins if m >= REAL_BUILD_MIN]
    if len(per_user) < MIN_LEARNERS or len(docs) < MIN_SESSIONS or not real:
        print(f"  NOT ENOUGH DATA TO ANSWER THE QUESTION.")
        print(f"    learners {len(per_user)} (need {MIN_LEARNERS}), sessions {len(docs)} (need {MIN_SESSIONS}),")
        print(f"    first sessions over {REAL_BUILD_MIN:.0f} min: {len(real)} (need at least 1)")
        print(f"    Everything above is real, but it is short test connections,")
        print(f"    not builds. The {FREE_CAP_MIN:.0f} minute cap is still an untested assumption.")
        return 0

    print(f"  free cap is {FREE_CAP_MIN:.0f} min; p90 first session is {p90_first:.1f} min")
    if p90_first > FREE_CAP_MIN:
        print(f"  --> the cap does NOT cover a first build for 1 in 10 learners.")
        print(f"      It would need to be about {p90_first * 1.15:.0f} min to.")
    else:
        headroom = FREE_CAP_MIN - p90_first
        print(f"  --> covers the 90th percentile first session with {headroom:.0f} min to spare.")

    # The damaging failure, read from the audit trail rather than inferred.
    print()
    print("  Cutoffs (tutor stopped mid-session) come from the audit log:")
    print("    gcloud logging read 'jsonPayload.event=\"live.budget.cutoff\"' \\")
    print("      --project=ohmlet-app --freshness=30d --format='value(jsonPayload.plan)'")
    print("  and refusals at the door from live.budget.refused. If cutoffs on the")
    print(f"  free plan exceed {RARE_PCT:.0f}% of free sessions, raise the cap.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
