#!/usr/bin/env bash
# deploy.sh — Automated Cloud Run deployment for Relay
#
# Usage:
#   ./deploy.sh              Deploy all services
#   ./deploy.sh live-bridge  Deploy live-bridge only
#   ./deploy.sh quiz-engine  Deploy quiz-engine only
#   ./deploy.sh frontend     Build and deploy frontend
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Project set: gcloud config set project relay-gemini

set -euo pipefail

# ── Configuration ──
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-relay-gemini}"
REGION="${GOOGLE_CLOUD_REGION:-europe-west1}"

# Service definitions
LIVE_BRIDGE_SERVICE="relay-live-bridge"
LIVE_BRIDGE_SOURCE="backend/live-bridge"
LIVE_BRIDGE_ENV="GOOGLE_GENAI_USE_VERTEXAI=TRUE,\
GOOGLE_CLOUD_PROJECT=${PROJECT_ID},\
GOOGLE_CLOUD_LOCATION=${REGION},\
RELAY_LIVE_MODEL=gemini-live-2.5-flash-native-audio"

QUIZ_ENGINE_SERVICE="relay-quiz-engine"
QUIZ_ENGINE_SOURCE="backend/quiz-engine"
QUIZ_ENGINE_ENV="GOOGLE_GENAI_USE_VERTEXAI=TRUE,\
GOOGLE_CLOUD_PROJECT=${PROJECT_ID},\
GOOGLE_CLOUD_LOCATION=${REGION}"

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
  local name="$1" source="$2" env_vars="$3"

  info "Deploying ${name} from ${source} to ${REGION}..."

  gcloud run deploy "$name" \
    --source="$source" \
    --region="$REGION" \
    --allow-unauthenticated \
    --set-env-vars="$env_vars" \
    --quiet

  local url
  url=$(gcloud run services describe "$name" --region="$REGION" --format="value(status.url)")
  ok "${name} deployed: ${url}"
}

deploy_live_bridge() {
  deploy_service "$LIVE_BRIDGE_SERVICE" "$LIVE_BRIDGE_SOURCE" "$LIVE_BRIDGE_ENV"
}

deploy_quiz_engine() {
  deploy_service "$QUIZ_ENGINE_SERVICE" "$QUIZ_ENGINE_SOURCE" "$QUIZ_ENGINE_ENV"
}

deploy_frontend() {
  info "Building frontend..."
  npm run build

  info "Frontend built successfully in dist/"
  ok "Deploy dist/ to your hosting provider (e.g. Firebase Hosting, Cloud Storage, Vercel)"
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
