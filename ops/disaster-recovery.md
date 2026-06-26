# Disaster Recovery — Ohmlet (#53)

> Status: living runbook. Last reviewed 2026-06-26. Owner: engineering.

What we protect, how we back it up, and exactly how to recover. Pair with
[`backup.sh`](backup.sh) (the tooling) and [`observability.md`](observability.md)
(how you find out something is wrong).

## What's at risk

| Data | Store | System of record? | Backup |
|------|-------|-------------------|--------|
| User profiles, progress (XP/streak/lessons), community, billing plan | **Firestore** | Yes | Daily scheduled export → GCS (this doc) |
| Session clips, serial logs, 3D assets | **Cloud Storage** | Yes (artifacts) | Object Versioning + lifecycle (below) |
| Stripe customers, subscriptions, invoices | **Stripe** | Yes (billing) | Stripe is the source of truth; we never need to restore it, only re-sync plan via webhook replay |
| Secrets (Stripe keys, metrics token) | **Secret Manager** | Yes | Versioned by Secret Manager; values also held in the team password manager |
| Code + infra config | **Git** (`ohmlet`/`origin`) | Yes | Distributed; mirror remotes |

Firestore is the one that needs an explicit, tested backup/restore path — the
others are either externally authoritative (Stripe), inherently versioned (Secret
Manager, Storage), or distributed (Git).

## Objectives

- **RPO (max data loss): 24 hours.** Driven by the daily Firestore export. A
  failure just before the next export loses at most a day of writes. If/when the
  product warrants it, tighten by increasing export frequency (the same scheduler
  job, a more frequent cron) — exports are incremental in cost, not effort.
- **RTO (max time to recover): 2 hours.** A Firestore import of launch-scale data
  completes well inside this; the budget covers detection, decision, and
  verification, not just the import command.

These are launch-stage targets. Revisit both as data volume and paying-user count
grow (a tighter RPO becomes worth the spend once daily active revenue is real).

## Backups in place

### Firestore — daily export to GCS
- **Bucket:** `gs://ohmlet-app-firestore-backups` (dedicated; separate from app
  data so one blast radius can't take both). Uniform access, `europe-west1`.
- **Retention:** 30 days via bucket lifecycle (older exports auto-delete).
- **Schedule:** Cloud Scheduler hits the Firestore export API daily at 03:17 UTC.
- **Set up once:**
  ```bash
  ./ops/backup.sh setup-bucket   # create bucket + lifecycle
  ./ops/backup.sh schedule       # create the daily Cloud Scheduler job
  ```
- **Ad-hoc backup (always take one before a risky migration):**
  ```bash
  ./ops/backup.sh export
  ```

### Cloud Storage (clips/logs/assets)
- Enable **Object Versioning** so an overwrite/delete is recoverable, with a
  lifecycle rule to expire noncurrent versions after 30 days:
  ```bash
  gcloud storage buckets update gs://<bucket> --versioning
  ```

## Recovery procedures

### A. Restore Firestore from a backup
1. **Stop the bleeding.** If corruption is ongoing (bad deploy/migration), roll
   back the offending live-bridge revision first so you don't restore into a
   process that re-breaks the data:
   ```bash
   gcloud run services update-traffic ohmlet-live-bridge --region=europe-west1 --to-revisions=PREVIOUS=100
   ```
2. **Pick the backup** (the last good one — usually the most recent pre-incident):
   ```bash
   ./ops/backup.sh list
   ```
3. **Import.** Importing overwrites documents at the same path and is additive for
   others (it does not delete docs created after the backup):
   ```bash
   ./ops/backup.sh restore gs://ohmlet-app-firestore-backups/<timestamp>
   ```
4. **Verify** before declaring done: spot-check a known user's profile + progress,
   a community post, and a billing plan. Confirm the app reads them and that
   `/internal/metrics` error rates are back to baseline.
5. **Re-sync billing if needed.** Plans are written by the Stripe webhook; if any
   plan looks wrong, replay recent events from the Stripe Dashboard
   (Developers → Webhooks → resend) — idempotent by design (#51).

### B. Accidental deletion of a single user / collection
Prefer a targeted fix over a full restore when the blast radius is small: import
the relevant export into a **temporary** project/database, read out the needed
documents, and write them back via a one-off script. Avoid a full import that
would roll back everyone else's recent writes.

### C. Total project loss
1. Recreate `ohmlet-app` infra (Cloud Run services via `./deploy.sh all`,
   Firestore database, buckets, secrets from the password manager).
2. Restore Firestore from the latest export (procedure A).
3. Re-point DNS / Firebase Hosting; redeploy frontend.
4. Verify auth, a live session, billing checkout, and community reads.

## Testing the plan (do not skip)

A backup you have never restored is a hope, not a backup. **Quarterly**, run a
restore drill into a scratch project:
1. `./ops/backup.sh export` (or use the latest scheduled export).
2. Import into a throwaway project; bring up live-bridge against it.
3. Time the end-to-end recovery and confirm it lands inside the 2-hour RTO.
4. Record the date + measured RTO at the bottom of this file; fix anything that
   made it slow or manual.

### Drill log
| Date | Backup used | Measured RTO | Notes |
|------|-------------|--------------|-------|
| _pending first drill_ | | | Run after `setup-bucket` + `schedule` are applied in prod. |
