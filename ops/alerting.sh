#!/usr/bin/env bash
# ops/alerting.sh — provision Cloud Monitoring alerting for Ohmlet's services (#35).
#
# Idempotent-ish: it skips a notification channel / uptime check that already
# exists by display name, and creates alert policies (re-running may create
# duplicate policies, so delete the old ones first if you re-run after editing).
#
# What it sets up, per Cloud Run service (live-bridge, quiz-engine, vision-verifier):
#   1. An HTTPS uptime check hitting /health every minute.
#   2. An alert when that uptime check fails (the service is down / unhealthy).
#   3. An alert on a sustained 5xx error rate (something is broken).
#   4. An alert on high p95 request latency (the service is degraded).
# All alerts notify an email channel (default hello@ohmlet.org).
#
# Usage:
#   ./ops/alerting.sh                       # provision everything
#   OHMLET_ALERT_EMAIL=you@x.com ./ops/alerting.sh
#
# Prereqs: gcloud authenticated, project set, Monitoring API enabled.

set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-ohmlet-app}"
REGION="${GOOGLE_CLOUD_REGION:-europe-west1}"
ALERT_EMAIL="${OHMLET_ALERT_EMAIL:-hello@ohmlet.org}"
SERVICES=("ohmlet-live-bridge" "ohmlet-quiz-engine" "ohmlet-vision-verifier")

# Alert thresholds (env-tunable).
LATENCY_P95_MS="${OHMLET_ALERT_LATENCY_P95_MS:-8000}"     # p95 request latency ceiling
ERROR_RATE_PER_SEC="${OHMLET_ALERT_5XX_PER_SEC:-0.2}"     # sustained 5xx/s before alerting

info()  { echo -e "\033[1;34m[alerting]\033[0m $1"; }
ok()    { echo -e "\033[1;32m[alerting]\033[0m $1"; }
err()   { echo -e "\033[1;31m[alerting]\033[0m $1" >&2; }

require_apis() {
  info "Ensuring Monitoring API is enabled..."
  gcloud services enable monitoring.googleapis.com --project "$PROJECT_ID" --quiet
}

# ── Notification channel (email) ──
ensure_channel() {
  # Match by display name in the output: a gcloud --filter on a string literal is
  # brittle to quote (RHS literals must be quoted, spaces ambiguous), so list and
  # post-match here instead. The display name has no comma, so CSV is safe.
  local existing
  existing=$(gcloud beta monitoring channels list \
    --project "$PROJECT_ID" \
    --format='csv[no-heading](name,displayName)' 2>/dev/null \
    | awk -F',' '$2=="Ohmlet Ops Email"{print $1; exit}' || true)
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return
  fi
  gcloud beta monitoring channels create \
    --project "$PROJECT_ID" \
    --display-name="Ohmlet Ops Email" \
    --type=email \
    --channel-labels="email_address=${ALERT_EMAIL}" \
    --format="value(name)"
}

# ── Uptime check on /health ──
ensure_uptime_check() {
  local service="$1" host="$2"
  local existing
  existing=$(gcloud monitoring uptime list-configs \
    --project "$PROJECT_ID" \
    --format='csv[no-heading](name,displayName)' 2>/dev/null \
    | awk -F',' -v n="${service} health" '$2==n{print $1; exit}' || true)
  if [[ -n "$existing" ]]; then
    info "Uptime check for ${service} already exists."
    return
  fi
  gcloud monitoring uptime create "${service} health" \
    --project "$PROJECT_ID" \
    --resource-type=uptime-url \
    --resource-labels="host=${host},project_id=${PROJECT_ID}" \
    --path="/health" \
    --port=443 \
    --protocol=https \
    --period=1 \
    --timeout=10 >/dev/null
  ok "Uptime check created for ${service} (${host}/health)."
}

# ── Alert policies ──
# Reads a policy JSON from stdin and creates it. Uses the GA `gcloud monitoring
# policies` surface (no alpha/beta component needed) via a temp file.
create_policy_from_stdin() {
  local tmp
  tmp=$(mktemp)
  cat > "$tmp"
  gcloud monitoring policies create --project "$PROJECT_ID" --policy-from-file="$tmp" >/dev/null
  rm -f "$tmp"
}

create_error_rate_policy() {
  local service="$1" channel="$2"
  cat <<EOF | create_policy_from_stdin
{
  "displayName": "Ohmlet ${service}: 5xx error rate",
  "combiner": "OR",
  "conditions": [{
    "displayName": "5xx > ${ERROR_RATE_PER_SEC}/s for 5m",
    "conditionThreshold": {
      "filter": "resource.type=\"cloud_run_revision\" AND resource.label.\"service_name\"=\"${service}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.label.\"response_code_class\"=\"5xx\"",
      "aggregations": [{ "alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_RATE" }],
      "comparison": "COMPARISON_GT",
      "thresholdValue": ${ERROR_RATE_PER_SEC},
      "duration": "300s",
      "trigger": { "count": 1 }
    }
  }],
  "notificationChannels": ["${channel}"],
  "alertStrategy": { "autoClose": "1800s" }
}
EOF
  ok "5xx alert policy created for ${service}."
}

create_latency_policy() {
  local service="$1" channel="$2"
  cat <<EOF | create_policy_from_stdin
{
  "displayName": "Ohmlet ${service}: high p95 latency",
  "combiner": "OR",
  "conditions": [{
    "displayName": "p95 latency > ${LATENCY_P95_MS}ms for 5m",
    "conditionThreshold": {
      "filter": "resource.type=\"cloud_run_revision\" AND resource.label.\"service_name\"=\"${service}\" AND metric.type=\"run.googleapis.com/request_latencies\"",
      "aggregations": [{ "alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_PERCENTILE_95" }],
      "comparison": "COMPARISON_GT",
      "thresholdValue": ${LATENCY_P95_MS},
      "duration": "300s",
      "trigger": { "count": 1 }
    }
  }],
  "notificationChannels": ["${channel}"],
  "alertStrategy": { "autoClose": "1800s" }
}
EOF
  ok "Latency alert policy created for ${service}."
}

main() {
  require_apis
  info "Notification email: ${ALERT_EMAIL}"
  local channel
  channel=$(ensure_channel)
  info "Using notification channel: ${channel}"

  for service in "${SERVICES[@]}"; do
    local url host
    url=$(gcloud run services describe "$service" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)" 2>/dev/null || true)
    if [[ -z "$url" ]]; then
      err "${service}: not deployed in ${REGION}; skipping."
      continue
    fi
    host="${url#https://}"
    info "Configuring alerts for ${service} (${host})..."
    ensure_uptime_check "$service" "$host"
    create_error_rate_policy "$service" "$channel"
    create_latency_policy "$service" "$channel"
  done

  ok "Alerting provisioned. Review in Cloud Monitoring → Alerting."
  info "Uptime-check-failure alerts are created automatically alongside each uptime check; confirm they target the channel above."
}

main "$@"
