#!/usr/bin/env bash
# End-to-end remote deploy + smoke test for Aurora (api/web via Docker Compose).
#
# Usage:
#   ./scripts/test-deploy-remote-e2e.sh HOST USER [--skip-deploy]
#
# Examples:
#   ./scripts/test-deploy-remote-e2e.sh 175.110.122.71 sus
#   ./scripts/test-deploy-remote-e2e.sh 175.110.122.71 sus --skip-deploy   # stack already up, just verify

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

HOST="${1:?usage: $0 HOST USER [--skip-deploy]}"
DEPLOY_USER="${2:?usage: $0 HOST USER [--skip-deploy]}"
shift 2 || true

SKIP_DEPLOY=0
for arg in "$@"; do
    case "$arg" in
        --skip-deploy) SKIP_DEPLOY=1 ;;
        -h|--help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown arg: $arg" >&2; exit 1 ;;
    esac
done

info() { echo "[e2e] $*"; }
fail() { echo "[e2e] FAIL: $*" >&2; exit 1; }

if [ "$SKIP_DEPLOY" -eq 0 ]; then
    info "Deploying to ${DEPLOY_USER}@${HOST}..."
    "${SCRIPT_DIR}/deploy-remote.sh" "${HOST}" "${DEPLOY_USER}"
fi

info "Smoke-testing http://${HOST}:8000/health and http://${HOST}:3000 ..."

HEALTH_JSON="$(curl -fsS --max-time 10 "http://${HOST}:8000/health" || true)"
[ -n "$HEALTH_JSON" ] || fail "GET /health returned nothing — is the api container running?"
echo "$HEALTH_JSON" | grep -q '"status"' || fail "GET /health response missing 'status' field: $HEALTH_JSON"
info "API health: $HEALTH_JSON"

WEB_STATUS="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "http://${HOST}:3000" || echo "000")"
[ "$WEB_STATUS" = "200" ] || fail "Web root returned HTTP ${WEB_STATUS} (expected 200)"
info "Web root: HTTP ${WEB_STATUS}"

info "Checking container status over SSH..."
ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "${DEPLOY_USER}@${HOST}" \
    'cd "$HOME/.deployments/aurora" && sudo docker compose --project-directory . -f infra/docker-compose.yml -f docker-compose.prod.yml ps' \
    || fail "Could not query container status over SSH"

info "All checks passed."
