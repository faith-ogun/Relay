# Blockers and unfinished edges

> Status: living checklist. Last reviewed 2026-06-27.

Things that are built but not fully live, or that need a decision/credential/action
only you can provide. Each item says exactly what unblocks it. Nothing here is
broken: every feature degrades cleanly (hidden UI or a clean 503) until unblocked.

## Needs a credential or a cloud action

### 1. 3D digital twin (#31) — needs a provider key + a bucket
The reporter service is built, tested, deployed-ready, and wired into the UI, but
generation stays off until two things exist:

- **A 3D-generation provider API key.** Default adapter targets Stability AI
  (image-to-3D, returns a GLB). Create an account, get a key, store it:
  ```bash
  printf '%s' "$STABILITY_API_KEY" | gcloud secrets create ohmlet-stability-key --data-file=-
  ```
  If you want a different provider (Meshy, Tripo, Rodin), say so and the adapter
  swaps; the rest of the service is provider-agnostic.
- **The twins storage bucket:**
  ```bash
  gcloud storage buckets create gs://ohmlet-app-twins \
    --project=ohmlet-app --location=europe-west1 --uniform-bucket-level-access
  ```
- Then `./deploy.sh reporter` and a frontend redeploy. Until the secret exists the
  service returns a clean 503 and the "Create 3D twin" button is hidden.
- Optional hardening: a least-privilege service account
  (`OHMLET_REPORTER_SA`) with only storage + datastore + secret access, matching
  the live-bridge SA pattern.

### 2. Firestore backups are coded but not RUNNING (#53)
`ops/backup.sh` + the disaster-recovery runbook exist, but no scheduled backup is
live yet. One-time setup (creates a bucket + a daily Cloud Scheduler job, minor
standing cost):
```bash
./ops/backup.sh setup-bucket
./ops/backup.sh schedule
```
Then do the first restore drill and record it in `ops/disaster-recovery.md`.

### 3. Transactional email via Resend (#28)
Not started. Needs a Resend account + verified domain (`ohmlet.org`) + an API key
stored in Secret Manager. Blocks: receipts, password-reset polish, re-engagement
email. Workspace (human mail at hello@/faith@) is already set up; this is the
programmatic sender.

### 4. Push + email re-engagement notifications (#66)
Needs the email sender (#28) and a web-push setup (VAPID keys + a service worker).
Friend-streak logic can be built first; delivery is the blocked part.

## Needs a product decision from you

### 5. 3D twin quota policy (part of #31)
I shipped sensible, env-tunable defaults: free 1, pro 30, max 100 twins/month. If
you want different numbers or a different gating (e.g. Max-only), it is a one-line
env change (`OHMLET_TWINS_FREE/PRO/MAX`). Confirm the policy when convenient.

### 6. Growth: Labs beta + virality loop (rest of #20)
The SEO build-guides part of #20 is shipped. The "Ohmlet Labs beta" and the
referral/virality loop both need product calls (what the beta gates, what the
referral reward is) before they can be built well.

### 7. Streak freezes + consumables economy (#65, #69)
The streak-freeze "first consumable" and the broader in-app-purchase/gems economy
need decisions on how items are earned vs bought, prices, and limits. The
mechanics are straightforward to build once the economy is decided.

### 8. Conversion engine + pricing recut (#18, #19)
#18 (first-build paywall + FBC7) needs the conversion strategy locked; #19 (re-cut
caps + tiers) is deliberately blocked until real cost/usage data exists.

## Blocked by external availability

### 9. Migrate live-bridge off Gemini 2.5 (#61)
Waiting on GA Gemini 3 live/pro models on Vertex. The current 2.5 family retires
2026-10-16, so this must land before then. Purely a "when the model ships" wait.

## User-side checklist (needs you in a browser)

### 10. Stripe go-live (#64)
Browser smoke test of Checkout, the cancellation/save flow + retention coupon, and
the test to live mode key swap. These need a human clicking through Stripe, so
they cannot be fully automated from here.

---

### Not blocked, just not started yet (FYI)
Interview Mode (#21, in progress now), multi-device QR bench-cam (#27), Sandbox
real-component expansion (#38, likely superseded by the simulator), native mobile
(#70). These need no external unblock; they are just queued work.
