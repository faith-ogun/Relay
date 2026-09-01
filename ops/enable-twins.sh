#!/usr/bin/env bash
# Turn the 3D twin on, once a Stability AI key exists.
#
# The reporter is the only Ohmlet service that has never had a running revision.
# It refuses to start because it mounts `ohmlet-stability-key` as a secret and
# that secret does not exist, which Cloud Run reports as:
#
#   Permission denied on secret: .../secrets/ohmlet-stability-key/versions/latest
#
# That is the whole blocker. Everything else the twin needs is already in place:
# the bucket, the IAM, the entitlement gate, the share links and the tests.
#
# THE KEY NEVER APPEARS IN AN ARGUMENT. Passing a secret as `$1` puts it in shell
# history, in `ps` output for every user on the machine, and in any command
# logging the shell has on. This reads it from a file or from a prompt that does
# not echo, and never prints it.
#
#   ops/enable-twins.sh                 # prompts, input hidden
#   ops/enable-twins.sh path/to/key     # reads the file, then you delete it
#
# Safe to re-run: it adds a new secret version rather than failing on an existing
# secret, and re-grants IAM that is already granted.
set -euo pipefail

PROJECT="ohmlet-app"
REGION="europe-west1"
SECRET="ohmlet-stability-key"
BUCKET="gs://ohmlet-app-twins"
# The reporter has no dedicated service account, so it runs as the project's
# compute default. If deploy.sh ever sets OHMLET_REPORTER_SA, change this too.
SA="182102811288-compute@developer.gserviceaccount.com"

say() { printf '\033[1;32m[twins]\033[0m %s\n' "$1"; }
die() { printf '\033[1;31m[twins]\033[0m %s\n' "$1" >&2; exit 1; }

command -v gcloud >/dev/null || die "gcloud is not on PATH."

# ── 1. The key ────────────────────────────────────────────────────────────────
if [ $# -ge 1 ]; then
  [ -f "$1" ] || die "no such file: $1"
  KEY="$(tr -d '\r\n' < "$1")"
  say "read the key from $1 (delete that file when this finishes)"
else
  printf 'Stability API key (input hidden): '
  stty -echo 2>/dev/null || true
  IFS= read -r KEY
  stty echo 2>/dev/null || true
  printf '\n'
fi

[ -n "${KEY:-}" ] || die "empty key, nothing to store."
case "$KEY" in
  sk-*) ;;
  *) printf '\033[1;33m[twins]\033[0m the key does not start with sk-. Continuing, but check it is the right one.\n' ;;
esac

# ── 2. Secret Manager ─────────────────────────────────────────────────────────
if gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1; then
  printf '%s' "$KEY" | gcloud secrets versions add "$SECRET" --project="$PROJECT" --data-file=- >/dev/null
  say "added a new version to the existing secret $SECRET"
else
  printf '%s' "$KEY" | gcloud secrets create "$SECRET" --project="$PROJECT" --data-file=- >/dev/null
  say "created secret $SECRET"
fi
unset KEY

# ── 3. Access ─────────────────────────────────────────────────────────────────
# Scoped to this one secret, not granted at the project level: the reporter needs
# the Stability key and has no business reading the Stripe keys next to it.
gcloud secrets add-iam-policy-binding "$SECRET" \
  --project="$PROJECT" \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null
say "granted secretAccessor on $SECRET to the reporter's service account"

# ── 4. The bucket ─────────────────────────────────────────────────────────────
# Created on 2026-08-29 with public access prevention enforced: a twin is never
# public, it is streamed through the authenticated /v1/twins/{id}/model endpoint
# after an ownership check. Re-checked here so this script is the whole story.
if gcloud storage buckets describe "$BUCKET" --project="$PROJECT" >/dev/null 2>&1; then
  say "bucket $BUCKET is there"
else
  gcloud storage buckets create "$BUCKET" \
    --project="$PROJECT" --location="$REGION" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access --public-access-prevention >/dev/null
  gcloud storage buckets add-iam-policy-binding "$BUCKET" \
    --project="$PROJECT" --member="serviceAccount:${SA}" \
    --role=roles/storage.objectAdmin >/dev/null
  say "created $BUCKET and granted the reporter object access"
fi

# ── 5. Deploy ─────────────────────────────────────────────────────────────────
say "deploying the reporter"
cd "$(dirname "$0")/.."
./deploy.sh reporter

# ── 6. Prove it ───────────────────────────────────────────────────────────────
URL="$(gcloud run services describe ohmlet-reporter --project="$PROJECT" --region="$REGION" \
        --format='value(status.url)' 2>/dev/null || true)"
[ -n "$URL" ] || die "the reporter deployed but has no URL. Check: gcloud run services describe ohmlet-reporter --project=$PROJECT --region=$REGION"

say "reporter is at $URL"
echo
# The phone reads `provider` off /health to decide whether twins are available at
# all, so this is the same question the app asks. `unconfigured` means the
# service is up and still cannot build anything, which is a different failure
# from the one this script exists to fix.
curl -s --max-time 20 "$URL/health" || die "the reporter is not answering /health"
echo
echo
say 'If that says "provider":"stability", the 3D twin works. Open Profile then 3D Twins on the phone.'
