#!/usr/bin/env bash
# deploy.sh — Automated Cloud Run deployment for Ohmlet
#
# Usage:
#   ./deploy.sh              Deploy all services
#   ./deploy.sh live-bridge  Deploy live-bridge only
#   ./deploy.sh quiz-engine  Deploy quiz-engine only
#   ./deploy.sh frontend     Build and deploy frontend
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
LIVE_BRIDGE_ENV="GOOGLE_GENAI_USE_VERTEXAI=TRUE,\
GOOGLE_CLOUD_PROJECT=${PROJECT_ID},\
GOOGLE_CLOUD_LOCATION=${REGION},\
OHMLET_LIVE_MODEL=gemini-live-2.5-flash-native-audio,\
OHMLET_FLASH_MODEL=gemini-2.5-flash,\
OHMLET_PRO_MODEL=gemini-2.5-pro,\
OHMLET_REASONING_MODEL=gemini-2.5-pro"
# Stripe secrets, mounted by reference from Secret Manager (same names across
# test/live; only the secret VERSION changes). Never a value in code.
LIVE_BRIDGE_SECRETS="STRIPE_SECRET_KEY=ohmlet-stripe-secret:latest,STRIPE_WEBHOOK_SECRET=ohmlet-stripe-webhook:latest"
# Non-secret, mode-specific billing config (Stripe price IDs + app URL). Kept in
# a gitignored file because the IDs differ between test and live mode. Each line
# is KEY=VALUE; see backend/live-bridge/.deploy.env.example.
LIVE_BRIDGE_ENV_FILE="${LIVE_BRIDGE_ENV_FILE:-backend/live-bridge/.deploy.env}"

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
  local name="$1" source="$2" env_vars="$3" service_account="${4:-}" min_instances="${5:-0}" secrets="${6:-}"

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
  deploy_service "$LIVE_BRIDGE_SERVICE" "$LIVE_BRIDGE_SOURCE" "$env_vars" "$LIVE_BRIDGE_SA" 0 "$LIVE_BRIDGE_SECRETS"
}

deploy_quiz_engine() {
  deploy_service "$QUIZ_ENGINE_SERVICE" "$QUIZ_ENGINE_SOURCE" "$QUIZ_ENGINE_ENV" "" "$QUIZ_ENGINE_MIN_INSTANCES"
}

deploy_frontend() {
  info "Building frontend..."
  ( cd frontend && npm run build )

  info "Frontend built successfully in frontend/dist/"
  ok "Deploy frontend/dist/ to your hosting provider (e.g. Firebase Hosting, Cloud Storage, Vercel)"
}

verify_services() {
  info "Verifying deployed services..."

  for service in "$LIVE_BRIDGE_SERVICE" "$QUIZ_ENGINE_SERVICE"; do
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
    frontend)
      deploy_frontend
      ;;
    verify)
      verify_services
      ;;
    all)
      deploy_live_bridge
      deploy_quiz_engine
      deploy_frontend
      echo ""
      verify_services
      echo ""
      ok "All services deployed!"
      ;;
    *)
      err "Unknown target: $1"
      echo "Usage: ./deploy.sh [live-bridge|quiz-engine|frontend|verify|all]"
      exit 1
      ;;
  esac
}

main "$@"
