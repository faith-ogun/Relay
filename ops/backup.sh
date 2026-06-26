#!/usr/bin/env bash
# backup.sh — Firestore backup + disaster-recovery tooling for Ohmlet (#53).
#
# Firestore is the system of record (user profiles, progress/XP/streak, community,
# billing plan). This script manages scheduled exports to Cloud Storage and the
# restore path, so we can recover from accidental deletion, a bad migration, or
# data corruption.
#
# Usage:
#   ./ops/backup.sh export                 One-off export to the backup bucket
#   ./ops/backup.sh schedule               Create the daily scheduled backup
#   ./ops/backup.sh list                   List available backups
#   ./ops/backup.sh restore gs://BUCKET/PREFIX [--yes]   Restore from an export
#   ./ops/backup.sh setup-bucket           Create the backup bucket + lifecycle
#
# Prereqs: gcloud authenticated; the caller needs datastore.importExportAdmin and
# storage admin on the bucket. RTO/RPO and the full runbook: ops/disaster-recovery.md.

set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-ohmlet-app}"
REGION="${GOOGLE_CLOUD_REGION:-europe-west1}"
# Dedicated, versioned backup bucket. Kept separate from app data buckets so a
# compromise or fat-finger on app storage can't also wipe the backups.
BACKUP_BUCKET="${OHMLET_BACKUP_BUCKET:-gs://${PROJECT_ID}-firestore-backups}"
# Keep daily backups for this many days (lifecycle rule on the bucket).
RETENTION_DAYS="${OHMLET_BACKUP_RETENTION_DAYS:-30}"
SCHEDULE_NAME="ohmlet-firestore-daily-backup"
# 03:17 UTC — off-peak, and a non-round minute so it doesn't collide with the
# herd of every-other-cron-on-the-hour.
SCHEDULE_CRON="${OHMLET_BACKUP_CRON:-17 3 * * *}"

info()  { echo -e "\033[1;34m[backup]\033[0m $1"; }
ok()    { echo -e "\033[1;32m[backup]\033[0m $1"; }
err()   { echo -e "\033[1;31m[backup]\033[0m $1" >&2; }

_stamp() { date -u +%Y-%m-%dT%H-%M-%SZ; }

setup_bucket() {
  if gcloud storage buckets describe "$BACKUP_BUCKET" --project="$PROJECT_ID" &>/dev/null; then
    info "Bucket ${BACKUP_BUCKET} already exists."
  else
    info "Creating ${BACKUP_BUCKET} (uniform access, ${REGION})..."
    gcloud storage buckets create "$BACKUP_BUCKET" \
      --project="$PROJECT_ID" --location="$REGION" --uniform-bucket-level-access
  fi
  # Auto-delete backups older than retention to bound cost.
  info "Applying ${RETENTION_DAYS}-day lifecycle rule..."
  local rule; rule="$(mktemp)"
  cat >"$rule" <<JSON
{"rule":[{"action":{"type":"Delete"},"condition":{"age":${RETENTION_DAYS}}}]}
JSON
  gcloud storage buckets update "$BACKUP_BUCKET" --lifecycle-file="$rule"
  rm -f "$rule"
  ok "Bucket ready with ${RETENTION_DAYS}-day retention."
}

export_now() {
  local dest="${BACKUP_BUCKET}/$(_stamp)"
  info "Exporting Firestore (${PROJECT_ID}) → ${dest}"
  gcloud firestore export "$dest" --project="$PROJECT_ID" --async
  ok "Export started (async). Track it: gcloud firestore operations list"
  ok "When complete, the export lives at: ${dest}"
}

schedule() {
  # Cloud Scheduler hits the Firestore Admin export API on a daily cadence. Each
  # run writes a timestamped export; the bucket lifecycle prunes old ones.
  local uri="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments"
  local sa="ohmlet-backup@${PROJECT_ID}.iam.gserviceaccount.com"
  info "Creating Cloud Scheduler job '${SCHEDULE_NAME}' (${SCHEDULE_CRON} UTC)..."
  info "Output bucket: ${BACKUP_BUCKET}/scheduled-\$(timestamp)"
  gcloud scheduler jobs create http "$SCHEDULE_NAME" \
    --project="$PROJECT_ID" --location="$REGION" \
    --schedule="$SCHEDULE_CRON" --time-zone="Etc/UTC" \
    --uri="$uri" --http-method=POST \
    --oauth-service-account-email="$sa" \
    --message-body="{\"outputUriPrefix\":\"${BACKUP_BUCKET}/scheduled\"}" \
    || err "Job may already exist — use 'gcloud scheduler jobs update http ${SCHEDULE_NAME}' to change it."
  ok "Daily backup scheduled. Verify: gcloud scheduler jobs list --location=${REGION}"
}

list_backups() {
  info "Backups in ${BACKUP_BUCKET}:"
  gcloud storage ls "$BACKUP_BUCKET" || err "No backups found (or bucket missing)."
}

restore() {
  local src="${1:-}"; local confirm="${2:-}"
  if [[ -z "$src" ]]; then err "Usage: ./ops/backup.sh restore gs://BUCKET/PREFIX [--yes]"; exit 1; fi
  err "RESTORE IS DESTRUCTIVE: importing overwrites documents with the same path."
  err "Target project: ${PROJECT_ID}    Source: ${src}"
  if [[ "$confirm" != "--yes" ]]; then
    read -r -p "Type the project id (${PROJECT_ID}) to proceed: " typed
    [[ "$typed" == "$PROJECT_ID" ]] || { err "Aborted."; exit 1; }
  fi
  info "Importing ${src} → ${PROJECT_ID} ..."
  gcloud firestore import "$src" --project="$PROJECT_ID"
  ok "Import started. Track: gcloud firestore operations list"
}

case "${1:-}" in
  setup-bucket) setup_bucket ;;
  export)       export_now ;;
  schedule)     schedule ;;
  list)         list_backups ;;
  restore)      shift; restore "$@" ;;
  *)
    err "Unknown command: ${1:-(none)}"
    echo "Usage: ./ops/backup.sh [setup-bucket|export|schedule|list|restore gs://… [--yes]]"
    exit 1
    ;;
esac
