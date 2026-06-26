# Caching Strategy — Ohmlet (#52)

> Status: living document. Last reviewed 2026-06-26.

Where we cache, for how long, and how staleness is bounded. The rule: cache only
what is shared and tolerant of brief staleness; never cache per-user private data
without explicit invalidation.

## Static assets (Firebase Hosting)

Configured in `frontend/firebase.json` → `hosting.headers`:

| Asset | `Cache-Control` | Why |
|-------|-----------------|-----|
| `/assets/**` (JS/CSS bundles) | `public, max-age=31536000, immutable` | Vite content-hashes the filename, so a URL's bytes never change. Cache forever; a deploy ships new hashed URLs. |
| Images/fonts/audio (`webp,png,svg,woff2,mp3,…`) | `public, max-age=2592000` | Stable per filename (e.g. achievement card art). 30-day cache, revalidates after. |
| `/index.html` | `no-cache` | The SPA shell must revalidate every load, or a deploy never reaches returning users. |

The browser therefore fetches the small HTML shell each visit and reuses
everything heavy (bundles, the ~7.5 MB of card art) from cache.

## API responses (backend)

Most endpoints are per-user and authenticated, so they are **not** HTTP-cacheable
and carry no cache headers. The expensive exception is handled in-process:

- **Weekly league top-100** (`/v1/community/leaderboard`). The standings list is
  identical for every user and is read on every Community open, so it is cached
  per ISO-week in a small TTL cache (`backend/live-bridge/app/cache.py`,
  `TTLCache`, default 20 s). The caller's own row (`me`) is always computed fresh,
  so a user's rank is never wrong even when the shared list is a few seconds old.
- **Invalidation:** `report_xp` changes the standings, so it calls
  `_leaderboard_cache.invalidate(week)` — the contributor gets read-your-writes
  immediately rather than waiting out the TTL.

### Trade-offs (deliberate)
- The cache is **per Cloud Run instance**. With several instances each may be up
  to one TTL stale; fine for a leaderboard, and it avoids standing up Redis at
  launch scale. Move to a shared cache only when cross-instance consistency or
  cache-hit rate actually demands it.
- The store is size-capped with FIFO eviction, so memory stays bounded even if
  keys proliferate.

## What we deliberately do NOT cache
- User profiles, progress (XP/streak/lessons), billing plan, entitlements — must
  be read-your-writes correct.
- Anything that gates access or money. Correctness over a few saved reads.
