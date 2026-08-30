#!/usr/bin/env bash
# deploy.sh — Automated Cloud Run deployment for Ohmlet
#
# Usage:
#   ./deploy.sh                  Deploy all services
#   ./deploy.sh live-bridge      Deploy live-bridge only
#   ./deploy.sh quiz-engine      Deploy quiz-engine only
#   ./deploy.sh vision-verifier  Deploy vision-verifier only
#   ./deploy.sh frontend         Build and deploy frontend
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Project set: gcloud config set project ohmlet-app

set -euo pipefail

# ── Configuration ──
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-ohmlet-app}"
REGION="${GOOGLE_CLOUD_REGION:-europe-west1}"

# Service definitions
LIVE_BRIDGE_SERVICE="ohmlet-live-bridge"
LIVE_BRIDGE_SOURCE="backend/live-bridge"
# Least-privilege runtime identity (#46): only datastore.user, aiplatform.user,
# logging.logWriter, secretmanager.secretAccessor — NOT the editor-privileged
# default compute SA. Override per-env if needed.
LIVE_BRIDGE_SA="${OHMLET_LIVE_BRIDGE_SA:-ohmlet-live-bridge@${PROJECT_ID}.iam.gserviceaccount.com}"
# Model pinning, checked against this project on 2026-08-27 rather than assumed.
#
#   probed europe-west1 : only gemini-2.5-* answer; every gemini-3.x is a 404
#   probed global       : 2.5-flash, 3.5, 3.6 and 3.7-flash all answer 200
#                         Pro: gemini-3.1-pro-preview answers, and it is the ONLY
#                         3.x Pro that does. Every non-preview 3.x Pro name 404s
#
# OHMLET_TEXT_LOCATION lets the tool and text calls run in `global` and reach a
# current model, while the live bidi session stays in the service's own region.
# Sharing one location is what held the tool calls on 2.5.
#
# STILL TO DO: OHMLET_LIVE_MODEL is a 2.5 model and 2.5 retires 2026-10-16, which
# is inside the Shipaton judging window. Its replacement id cannot be verified
# without opening a bidi session, so it is migrated on a deployed revision and
# checked, not guessed here. scripts/check-model-currency.mjs fails when this is
# still unresolved.
#
# The minute caps and the token rates are set HERE as well as defaulted in code,
# so the deployed numbers are visible in one place rather than only inside a
# Python file. Both were changed on 2026-08-28: the caps came down from
# 60/600/1800 because Pro and Max lost money at full utilisation, and the token
# rates were set at all, having defaulted to ZERO, which made the Pro-model spend
# that premium routing exists to protect invisible to the meter watching it.
# The arithmetic is in backend/live-bridge/app/entitlements.py.
LIVE_BRIDGE_ENV="GOOGLE_GENAI_USE_VERTEXAI=TRUE,\
GOOGLE_CLOUD_PROJECT=${PROJECT_ID},\
GOOGLE_CLOUD_LOCATION=${REGION},\
OHMLET_LIVE_MODEL=gemini-live-2.5-flash-native-audio,\
OHMLET_TEXT_LOCATION=global,\
OHMLET_FLASH_MODEL=gemini-3.7-flash,\
OHMLET_PRO_MODEL=gemini-3.1-pro-preview,\
OHMLET_REASONING_MODEL=gemini-3.1-pro-preview,\
OHMLET_LIVE_MIN_FREE=60,\
OHMLET_LIVE_MIN_PRO=240,\
OHMLET_LIVE_MIN_MAX=540,\
OHMLET_RATE_PROMPT_1K_USD=0.00125,\
OHMLET_RATE_RESPONSE_1K_USD=0.010,\
OHMLET_FILMS_BUCKET=ohmlet-app-lessons,\
OHMLET_FILMS_VERSION=v1"
# Stripe secrets + the metrics token, mounted by reference from Secret Manager
# (same names across test/live; only the secret VERSION changes). Never a value
# in code. OHMLET_METRICS_TOKEN guards /internal/metrics (#35).
# RevenueCat joins Stripe here because the two webhooks are the only writers of a
# paid plan, one per surface. Both handlers refuse with 503 when their secret is
# absent rather than treating an empty string as a match, so a missing secret is
# a dead endpoint and never an open one.
LIVE_BRIDGE_SECRETS="STRIPE_SECRET_KEY=ohmlet-stripe-secret:latest,STRIPE_WEBHOOK_SECRET=ohmlet-stripe-webhook:latest,OHMLET_METRICS_TOKEN=ohmlet-metrics-token:latest,OHMLET_REVENUECAT_WEBHOOK_SECRET=ohmlet-revenuecat-webhook:latest"
# Non-secret, mode-specific billing config (Stripe price IDs + app URL). Kept in
# a gitignored file because the IDs differ between test and live mode. Each line
# is KEY=VALUE; see backend/live-bridge/.deploy.env.example.
LIVE_BRIDGE_ENV_FILE="${LIVE_BRIDGE_ENV_FILE:-backend/live-bridge/.deploy.env}"
# Keep one instance warm. live-bridge was at 0, so it scaled to zero after a
# quiet period and the NEXT thing anyone did paid a full container boot —
# ADK, google-genai and a 700KB lesson store loading before a byte came back.
# Warm requests are 30-450ms, so every 'community is slow' report was a cold
# start, and the same tax landed on the live tutor, where a learner is waiting
# to speak. One instance at 1 CPU / 512Mi is roughly $10-15 a month; set
# OHMLET_LIVE_BRIDGE_MIN_INSTANCES=0 to trade it back for the latency.
LIVE_BRIDGE_MIN_INSTANCES="${OHMLET_LIVE_BRIDGE_MIN_INSTANCES:-1}"

QUIZ_ENGINE_SERVICE="ohmlet-quiz-engine"
QUIZ_ENGINE_SOURCE="backend/quiz-engine"
# Gemini 3.5 Flash (the GA, non-deprecating model; 2.5 retires 2026-10-16) is
# served from the `global` Vertex location, so the genai client must target it.
QUIZ_ENGINE_ENV="GOOGLE_GENAI_USE_VERTEXAI=TRUE,\
GOOGLE_CLOUD_PROJECT=${PROJECT_ID},\
GOOGLE_CLOUD_LOCATION=global"
# Cold starts add seconds to the (latency-critical) drawing assessment. cpu-boost
# is always on; set this to 1 to keep one instance warm and remove cold starts
# entirely (small standing cost). Default 0 to avoid standing spend.
QUIZ_ENGINE_MIN_INSTANCES="${OHMLET_QUIZ_MIN_INSTANCES:-0}"
# Metrics token guarding /internal/metrics (#35), by reference from Secret Manager.
QUIZ_ENGINE_SECRETS="OHMLET_METRICS_TOKEN=ohmlet-metrics-token:latest"

VISION_VERIFIER_SERVICE="ohmlet-vision-verifier"
VISION_VERIFIER_SOURCE="backend/vision-verifier"
# Same Vertex config as quiz-engine: Gemini 3.5 Flash on the `global` location.
VISION_VERIFIER_ENV="GOOGLE_GENAI_USE_VERTEXAI=TRUE,\
GOOGLE_CLOUD_PROJECT=${PROJECT_ID},\
GOOGLE_CLOUD_LOCATION=global"
# Optional least-privilege SA (needs aiplatform.user + logging.logWriter); empty
# falls back to the default compute SA, matching quiz-engine.
VISION_VERIFIER_SA="${OHMLET_VISION_VERIFIER_SA:-}"
# The inventory check runs at the start of a live session, so cold starts hurt.
# cpu-boost is always on; set this to 1 to keep one warm (small standing cost).
VISION_VERIFIER_MIN_INSTANCES="${OHMLET_VISION_MIN_INSTANCES:-0}"
# Metrics token guarding /internal/metrics (#35), by reference from Secret Manager.
VISION_VERIFIER_SECRETS="OHMLET_METRICS_TOKEN=ohmlet-metrics-token:latest"

COMPILER_SERVICE="ohmlet-compiler"
COMPILER_SOURCE="backend/compiler"
COMPILER_ENV="GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
COMPILER_SA="${OHMLET_COMPILER_SA:-}"
# Kept warm (1): the toolchain image is large, so a cold start is slow; one
# standing instance makes compiles instant. Set OHMLET_COMPILER_MIN_INSTANCES=0 to save cost.
COMPILER_MIN_INSTANCES="${OHMLET_COMPILER_MIN_INSTANCES:-1}"
COMPILER_SECRETS="OHMLET_METRICS_TOKEN=ohmlet-metrics-token:latest"
# Compiling avr-gcc is CPU/RAM-heavy and the image (with the AVR core) is large,
# so give it more headroom and a longer request timeout than the vision services.
COMPILER_EXTRA="--memory=2Gi --cpu=2 --timeout=120 --concurrency=4"

REPORTER_SERVICE="ohmlet-reporter"
REPORTER_SOURCE="backend/reporter"
REPORTER_ENV="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},OHMLET_TWIN_PROVIDER=stability"
REPORTER_SA="${OHMLET_REPORTER_SA:-}"
REPORTER_MIN_INSTANCES="${OHMLET_REPORTER_MIN_INSTANCES:-0}"
# The 3D-provider API key + the metrics token, by reference from Secret Manager
# (never a value in code). Create the secret once: see backend/reporter/README.md.
REPORTER_SECRETS="STABILITY_API_KEY=ohmlet-stability-key:latest,OHMLET_METRICS_TOKEN=ohmlet-metrics-token:latest"
# Image→mesh generation can take tens of seconds; give it a long request timeout
# and low concurrency (each call holds an upstream request open).
REPORTER_EXTRA="--memory=1Gi --cpu=1 --timeout=300 --concurrency=8"

# ── Helpers ──
info()  { echo -e "\033[1;34m[deploy]\033[0m $1"; }
ok()    { echo -e "\033[1;32m[deploy]\033[0m $1"; }
err()   { echo -e "\033[1;31m[deploy]\033[0m $1" >&2; }

check_gcloud() {
  if ! command -v gcloud &>/dev/null; then
    err "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi

  local current_project
  current_project=$(gcloud config get-value project 2>/dev/null)
  if [[ "$current_project" != "$PROJECT_ID" ]]; then
    info "Setting project to ${PROJECT_ID}"
    gcloud config set project "$PROJECT_ID"
  fi
}

deploy_service() {
  local name="$1" source="$2" env_vars="$3" service_account="${4:-}" min_instances="${5:-0}" secrets="${6:-}" extra="${7:-}"

  info "Deploying ${name} from ${source} to ${REGION}..."

  local sa_flag=()
  if [[ -n "$service_account" ]]; then
    sa_flag=(--service-account="$service_account")
    info "Running as least-privilege SA: ${service_account}"
  fi

  # Secrets are mounted from Secret Manager by reference (never a value in code).
  # Kept in sync here so a plain `--set-env-vars` deploy never drops them.
  local secrets_flag=()
  if [[ -n "$secrets" ]]; then
    secrets_flag=(--set-secrets="$secrets")
  fi

  # --cpu-boost speeds the cold start (extra CPU only during container start, so
  # negligible cost). --min-instances keeps N warm to remove cold starts entirely
  # (standing cost); default 0, set per service for latency-critical paths.
  gcloud run deploy "$name" \
    --source="$source" \
    --region="$REGION" \
    --allow-unauthenticated \
    --set-env-vars="$env_vars" \
    --cpu-boost \
    --min-instances="$min_instances" \
    ${sa_flag[@]+"${sa_flag[@]}"} \
    ${secrets_flag[@]+"${secrets_flag[@]}"} \
    ${extra:+$extra} \
    --quiet

  local url
  url=$(gcloud run services describe "$name" --region="$REGION" --format="value(status.url)")
  ok "${name} deployed: ${url}"
}

deploy_live_bridge() {
  local env_vars="$LIVE_BRIDGE_ENV"
  # Append the gitignored billing config (price IDs + app URL) if present, so a
  # redeploy never drops it. Lines are KEY=VALUE; blanks/comments ignored.
  if [[ -f "$LIVE_BRIDGE_ENV_FILE" ]]; then
    local line
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%%#*}"; line="${line//[[:space:]]/}"
      [[ -n "$line" && "$line" == *=* ]] && env_vars="${env_vars},${line}"
    done < "$LIVE_BRIDGE_ENV_FILE"
    info "Loaded billing config from ${LIVE_BRIDGE_ENV_FILE}"
  else
    info "No ${LIVE_BRIDGE_ENV_FILE} found; deploying without Stripe price IDs (billing inert)."
  fi
  deploy_service "$LIVE_BRIDGE_SERVICE" "$LIVE_BRIDGE_SOURCE" "$env_vars" "$LIVE_BRIDGE_SA" "$LIVE_BRIDGE_MIN_INSTANCES" "$LIVE_BRIDGE_SECRETS"
}

deploy_quiz_engine() {
  deploy_service "$QUIZ_ENGINE_SERVICE" "$QUIZ_ENGINE_SOURCE" "$QUIZ_ENGINE_ENV" "" "$QUIZ_ENGINE_MIN_INSTANCES" "$QUIZ_ENGINE_SECRETS"
}

deploy_vision_verifier() {
  deploy_service "$VISION_VERIFIER_SERVICE" "$VISION_VERIFIER_SOURCE" "$VISION_VERIFIER_ENV" "$VISION_VERIFIER_SA" "$VISION_VERIFIER_MIN_INSTANCES" "$VISION_VERIFIER_SECRETS"
}

deploy_compiler() {
  deploy_service "$COMPILER_SERVICE" "$COMPILER_SOURCE" "$COMPILER_ENV" "$COMPILER_SA" "$COMPILER_MIN_INSTANCES" "$COMPILER_SECRETS" "$COMPILER_EXTRA"
}

deploy_reporter() {
  deploy_service "$REPORTER_SERVICE" "$REPORTER_SOURCE" "$REPORTER_ENV" "$REPORTER_SA" "$REPORTER_MIN_INSTANCES" "$REPORTER_SECRETS" "$REPORTER_EXTRA"
}

deploy_frontend() {
  if ! command -v firebase >/dev/null 2>&1; then
    err "firebase CLI not found. Install it with: npm i -g firebase-tools"
    err "Then authenticate once with: firebase login"
    exit 1
  fi

  info "Building frontend..."
  ( cd frontend && npm run build )

  # The build must not silently ship a localhost service URL. The live tutor
  # once went to production pointing at ws://localhost:8082 because one VITE_*
  # key was missing from frontend/.env, and nothing caught it.
  # A port is required: our dev fallbacks are all localhost:PORT, and they only
  # survive minification when the corresponding VITE_* var is MISSING (otherwise
  # the `||` short-circuits and the literal is dropped). A bare "http://localhost"
  # is the Firebase Auth SDK's own popup constant, not ours, so it must not trip.
  if grep -rqE "(ws|http)s?://localhost:[0-9]+" frontend/dist/assets/*.js 2>/dev/null; then
    err "Refusing to deploy: the built bundle still contains a localhost URL."
    err "A VITE_* service URL is missing from frontend/.env — fix it and rebuild."
    exit 1
  fi
  ok "Build clean (no localhost URLs in the bundle)"

  # Hosting AND the Firestore rules. The rules are the only thing standing
  # between the client and the database, so they ship with the app that relies
  # on them rather than drifting out of sync in git.
  info "Deploying hosting + Firestore rules to ${PROJECT_ID}..."
  ( cd frontend && firebase deploy --only hosting,firestore:rules --project "$PROJECT_ID" )

  ok "Frontend and Firestore rules deployed"
}

verify_services() {
  info "Verifying deployed services..."

  for service in "$LIVE_BRIDGE_SERVICE" "$QUIZ_ENGINE_SERVICE" "$VISION_VERIFIER_SERVICE" "$COMPILER_SERVICE" "$REPORTER_SERVICE"; do
    local url
    url=$(gcloud run services describe "$service" --region="$REGION" --format="value(status.url)" 2>/dev/null)
    if [[ -n "$url" ]]; then
      local status
      status=$(curl -s -o /dev/null -w "%{http_code}" "${url}/health" 2>/dev/null || echo "000")
      if [[ "$status" == "200" ]]; then
        ok "${service}: healthy (${url})"
      else
        err "${service}: returned HTTP ${status} (${url})"
      fi
    else
      err "${service}: not found in ${REGION}"
    fi
  done
}

# ── Main ──
main() {
  check_gcloud

  case "${1:-all}" in
    live-bridge)
      deploy_live_bridge
      ;;
    quiz-engine)
      deploy_quiz_engine
      ;;
    vision-verifier)
      deploy_vision_verifier
      ;;
    compiler)
      deploy_compiler
      ;;
    reporter)
      deploy_reporter
      ;;
    frontend)
      deploy_frontend
      ;;
    verify)
      verify_services
      ;;
    all)
      deploy_live_bridge
      deploy_quiz_engine
      deploy_vision_verifier
      deploy_compiler
      deploy_reporter
      deploy_frontend
      echo ""
      verify_services
      echo ""
      ok "All services deployed!"
      ;;
    *)
      err "Unknown target: $1"
      echo "Usage: ./deploy.sh [live-bridge|quiz-engine|vision-verifier|compiler|reporter|frontend|verify|all]"
      exit 1
      ;;
  esac
}

main "$@"
