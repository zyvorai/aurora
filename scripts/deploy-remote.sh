#!/usr/bin/env bash
# ============================================================================
# deploy-remote.sh — Deploy Aurora (api/web/workers + backing infra) to a
# remote Docker host over SSH.
#
# Unlike the sibling ../forge-adapters project, this app's production target
# is plain Docker Compose (see docker-compose.prod.yml + infra/docker-compose.yml),
# not Kubernetes/CRDs/operators — this script is sized to match: rsync the repo,
# ensure Docker is present, bring the stack up, wait for health, print status.
#
# Usage:
#   ./scripts/deploy-remote.sh <host> [user] [--skip-build] [--uninstall]
#   ./scripts/deploy-remote.sh 175.110.122.71 sus                # SSH key auth
#   ./scripts/deploy-remote.sh 175.110.122.71 root mypassword    # password auth (needs sshpass)
#   ./scripts/deploy-remote.sh 175.110.122.71 sus --skip-build   # up without --build (reuse cached images)
#   ./scripts/deploy-remote.sh 175.110.122.71 sus --uninstall    # stop and remove the stack
#
# Environment variables:
#   DEPLOY_HOST / DEPLOY_USER / DEPLOY_PASS   same as positional args
#   DEPLOY_DIR=.deployments/aurora          remote path (relative to $HOME) the repo syncs to
#   HEALTH_TIMEOUT=120                        seconds to wait for /health before failing
#
# Remote prerequisites: Docker Engine, rsync, and an SSH user with passwordless
# sudo (this script runs all docker/compose commands via `sudo docker ...` --
# it does not assume the SSH user is in the `docker` group). Installs the
# Compose v2 plugin automatically via apt if missing. A `.env` populated from
# .env.prod.example must exist on the remote (seeded automatically on first
# deploy if missing, but real secrets must be edited in by hand afterward).
# ============================================================================

set -euo pipefail

info()  { echo "[deploy] $*"; }
warn()  { echo "[deploy] WARNING: $*" >&2; }
error() { echo "[deploy] ERROR: $*" >&2; exit 1; }

# ── Parse args ──
SKIP_BUILD=false
UNINSTALL=false
POSITIONAL=()
for arg in "$@"; do
    case "$arg" in
        --skip-build) SKIP_BUILD=true ;;
        --uninstall)  UNINSTALL=true ;;
        --help|-h)
            sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) POSITIONAL+=("$arg") ;;
    esac
done

HOST="${POSITIONAL[0]:-${DEPLOY_HOST:-}}"
DEPLOY_USER="${POSITIONAL[1]:-${DEPLOY_USER:-root}}"
PASS="${POSITIONAL[2]:-${DEPLOY_PASS:-}}"
[ -z "$HOST" ] && error "Usage: $0 <host> [user] [password] [--skip-build|--uninstall]"

REMOTE_DIR="${DEPLOY_DIR:-.deployments/aurora}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
[ -f "$REPO_DIR/docker-compose.prod.yml" ] || error "Not in the Aurora repo root: $REPO_DIR"

# ── SSH/rsync wrappers ──
_ssh() {
    if [ -n "$PASS" ]; then
        command -v sshpass &>/dev/null || error "sshpass required for password auth (brew install hudochenkov/sshpass/sshpass)"
        SSHPASS="$PASS" sshpass -e ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "${DEPLOY_USER}@${HOST}" "$@"
    else
        ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "${DEPLOY_USER}@${HOST}" "$@"
    fi
}

_rsync() {
    local ssh_cmd="ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
    [ -n "$PASS" ] && ssh_cmd="sshpass -e $ssh_cmd"
    SSHPASS="$PASS" rsync -avz \
        --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' \
        --exclude='node_modules' --exclude='.next' --exclude='.venv' \
        --exclude='*.egg-info' --exclude='.pytest_cache' \
        -e "$ssh_cmd" \
        "$@"
}

info "Target: ${DEPLOY_USER}@${HOST}:~/${REMOTE_DIR}"

# All docker/compose calls go through sudo -- don't assume the SSH user is in
# the docker group (true on at least one lab host this has been run against).
# --project-directory is required: with infra/docker-compose.yml listed first,
# compose would otherwise treat infra/ (not the repo root) as the project dir,
# and docker-compose.prod.yml's `env_file: .env` would resolve to infra/.env.
DC="sudo docker compose --project-directory . -f infra/docker-compose.yml -f docker-compose.prod.yml"

# Auto-enable the nginx/TLS overlay once a real cert has been placed on the
# remote host (see infra/nginx/certs/README.md) -- nothing to configure here,
# it just starts showing up once you've done the manual CA + DNS steps.
if _ssh "test -f \"\$HOME/${REMOTE_DIR}/infra/nginx/certs/aurora.zyvor.dev.crt\" && test -f \"\$HOME/${REMOTE_DIR}/infra/nginx/certs/aurora.zyvor.dev.key\"" 2>/dev/null; then
    info "Found aurora.zyvor.dev cert on remote — enabling nginx/TLS overlay."
    DC="${DC} -f infra/nginx/docker-compose.nginx.yml"
fi

# ── Uninstall mode ──
if $UNINSTALL; then
    info "Stopping and removing the Aurora stack on ${HOST}..."
    _ssh "cd \"\$HOME/${REMOTE_DIR}\" && ${DC} down" \
        || warn "Compose down failed or stack was already down"
    info "Uninstall step complete (repo left on disk at ~/${REMOTE_DIR}; remove manually if desired)."
    exit 0
fi

# ── Step 1: preflight ──
info "Checking remote prerequisites..."
_ssh '
    command -v docker >/dev/null || { echo "MISSING: docker"; exit 1; }
    command -v rsync >/dev/null || { echo "MISSING: rsync"; exit 1; }
    sudo -n true 2>/dev/null || { echo "MISSING: passwordless sudo for docker access"; exit 1; }
    echo "docker: $(docker --version)"
    if ! sudo docker compose version >/dev/null 2>&1; then
        echo "docker compose plugin missing — trying apt (docker-compose-plugin)..."
        if ! (sudo apt-get update -qq && sudo apt-get install -y -qq docker-compose-plugin) >/dev/null 2>&1; then
            echo "apt install unavailable — installing the Compose v2 static binary instead..."
            ARCH="$(uname -m)"
            case "$ARCH" in
                x86_64)  COMPOSE_ARCH="x86_64" ;;
                aarch64) COMPOSE_ARCH="aarch64" ;;
                *) echo "MISSING: unsupported arch $ARCH for compose binary fallback"; exit 1 ;;
            esac
            sudo mkdir -p /usr/local/lib/docker/cli-plugins
            sudo curl -fsSL -o /usr/local/lib/docker/cli-plugins/docker-compose \
                "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${COMPOSE_ARCH}"
            sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
        fi
    fi
    sudo docker compose version >/dev/null 2>&1 || { echo "MISSING: docker compose still not available after install attempts"; exit 1; }
    echo "compose: $(sudo docker compose version --short 2>/dev/null || echo unknown)"
' || error "Remote prerequisites check failed on ${HOST}"

# ── Step 2: sync repo ──
info "Syncing repository..."
_ssh "mkdir -p \"\$HOME/${REMOTE_DIR}\""
_rsync "$REPO_DIR/" "${DEPLOY_USER}@${HOST}:${REMOTE_DIR}/"
info "Synced."

# ── Step 3: ensure .env exists ──
_ssh "
    cd \"\$HOME/${REMOTE_DIR}\"
    if [ ! -f .env ]; then
        cp .env.prod.example .env
        echo 'Seeded .env from .env.prod.example — SSH in and edit secrets (SECRET_KEY, SMTP_*, etc.) before relying on this deploy.'
    else
        echo '.env already present, left untouched.'
    fi
"

# ── Step 3b: refuse to bake a broken NEXT_PUBLIC_API_URL into the web image ──
# It's a build-time value baked into the browser bundle -- if it's still the
# .env.prod.example placeholder or "localhost", every VISITOR's browser tries
# to call their own machine instead of this server, not this container. This
# caught a real bug where the deployed app silently didn't work for anyone but
# whoever ran curl from the deploy host itself.
NEXT_PUBLIC_API_URL_REMOTE="$(_ssh "grep -m1 '^NEXT_PUBLIC_API_URL=' \"\$HOME/${REMOTE_DIR}/.env\" 2>/dev/null || true")"
if ! $SKIP_BUILD; then
    if echo "$NEXT_PUBLIC_API_URL_REMOTE" | grep -qE 'localhost|127\.0\.0\.1|YOUR_SERVER_IP_OR_DOMAIN'; then
        if [ "${ALLOW_LOCALHOST_API_URL:-false}" != "true" ]; then
            error "Remote .env has ${NEXT_PUBLIC_API_URL_REMOTE:-NEXT_PUBLIC_API_URL unset}, which visiting browsers can't reach. SSH in and set NEXT_PUBLIC_API_URL to this host's real address (e.g. http://${HOST}:8000/api/v1 or https://your-domain/api/v1) before deploying, or set ALLOW_LOCALHOST_API_URL=true to override."
        fi
    fi
fi

# ── Step 4: bring the stack up ──
BUILD_FLAG="--build"
$SKIP_BUILD && BUILD_FLAG=""
info "Starting stack (docker compose up -d ${BUILD_FLAG})..."
_ssh "cd \"\$HOME/${REMOTE_DIR}\" && ${DC} up -d ${BUILD_FLAG}"
info "Stack started."

# ── Step 5: wait for health ──
info "Waiting up to ${HEALTH_TIMEOUT}s for API health check..."
if _ssh "
    end=\$((SECONDS + ${HEALTH_TIMEOUT}))
    while [ \$SECONDS -lt \$end ]; do
        if curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
            echo 'API healthy.'
            exit 0
        fi
        sleep 3
    done
    echo 'API did not become healthy in time.'
    exit 1
"; then
    info "Deployment healthy."
else
    warn "Health check did not pass within ${HEALTH_TIMEOUT}s — check logs: ssh ${DEPLOY_USER}@${HOST} 'cd ~/${REMOTE_DIR} && sudo docker compose --project-directory . -f infra/docker-compose.yml -f docker-compose.prod.yml logs --tail=100 api'"
fi

# ── Status ──
info "Container status:"
_ssh "cd \"\$HOME/${REMOTE_DIR}\" && ${DC} ps"

echo ""
echo "  Web:  http://${HOST}:3000"
echo "  API:  http://${HOST}:8000  (health: http://${HOST}:8000/health)"
echo ""
echo "  Logs:    ssh ${DEPLOY_USER}@${HOST} 'cd ~/${REMOTE_DIR} && sudo docker compose --project-directory . -f infra/docker-compose.yml -f docker-compose.prod.yml logs -f'"
echo "  E2E test: ./scripts/test-deploy-remote-e2e.sh ${HOST} ${DEPLOY_USER} --skip-deploy"
echo ""
