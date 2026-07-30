#!/usr/bin/env bash
# Start GTM Platform dev environment (infra + API + web).
#
# Usage:
#   ./infra/scripts/start.sh              # full start: infra, db init, api + web
#   ./infra/scripts/start.sh --infra        # docker compose only
#   ./infra/scripts/start.sh --apps         # api + web only (infra must be running)
#   ./infra/scripts/start.sh --workers      # also start background workers
#   ./infra/scripts/start.sh --skip-install # skip pip/npm install checks
#   ./infra/scripts/start.sh --help

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker-compose.yml"
VENV="$ROOT/apps/api/.venv"
LOG_DIR="$ROOT/.logs"
PID_DIR="$ROOT/.run"

START_INFRA=true
START_APPS=true
START_WORKERS=false
SKIP_INSTALL=false

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \?//'
}

log() { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

port_in_use() {
  lsof -ti tcp:"$1" >/dev/null 2>&1
}

require_docker() {
  command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker Desktop."
  docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop first."
}

ensure_env() {
  if [[ ! -f "$ROOT/.env" ]]; then
    log "Creating .env from .env.example"
    cp "$ROOT/.env.example" "$ROOT/.env"
  fi
}

ensure_install() {
  if [[ "$SKIP_INSTALL" == true ]]; then
    return 0
  fi

  if [[ ! -d "$VENV" ]]; then
    log "Creating Python 3.12 venv..."
    (cd "$ROOT/apps/api" && python3.12 -m venv .venv)
  fi
  if [[ ! -x "$VENV/bin/uvicorn" ]]; then
    log "Installing API dependencies..."
    (cd "$ROOT/apps/api" && .venv/bin/pip install -e ".[dev]")
  fi

  if [[ ! -d "$ROOT/apps/web/node_modules" ]]; then
    log "Installing web dependencies..."
    (cd "$ROOT/apps/web" && npm install)
  fi
}

wait_for_postgres() {
  log "Waiting for Postgres..."
  for _ in $(seq 1 30); do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U gtm -d gtm_platform >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  die "Postgres did not become ready in time."
}

start_infra() {
  require_docker
  ensure_env
  log "Starting Docker infrastructure..."
  docker compose -f "$COMPOSE_FILE" up -d
  wait_for_postgres
  log "Infrastructure is up."
}

init_database() {
  [[ -x "$VENV/bin/python" ]] || die "API venv missing. Run without --skip-install."
  log "Initializing database tables (idempotent)..."
  (cd "$ROOT/apps/api" && .venv/bin/python scripts/init_db.py)
}

start_background() {
  local name="$1"
  local workdir="$2"
  shift 2
  local pidfile="$PID_DIR/${name}.pid"
  local logfile="$LOG_DIR/${name}.log"

  mkdir -p "$LOG_DIR" "$PID_DIR"

  if [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    warn "$name already running (pid $(cat "$pidfile"))"
    return 0
  fi

  log "Starting $name..."
  (
    cd "$workdir"
    nohup "$@" >>"$logfile" 2>&1 &
    echo $! >"$pidfile"
  )
  log "$name started (pid $(cat "$pidfile"), log: $logfile)"
}

start_apps() {
  ensure_install

  if port_in_use 8000; then
    warn "Port 8000 in use — API may already be running"
  else
    start_background "api" "$ROOT/apps/api" \
      "$VENV/bin/uvicorn" gtm_api.main:app --reload --port 8000
  fi

  if port_in_use 3000; then
    warn "Port 3000 in use — web may already be running"
  else
    start_background "web" "$ROOT/apps/web" \
      npm run dev
  fi
}

start_worker_process() {
  if pgrep -f "gtm_workers.main" >/dev/null 2>&1; then
    warn "Workers already running"
    return 0
  fi
  start_background "workers" "$ROOT/apps/workers" \
    "$VENV/bin/python" -m gtm_workers.main
}

print_status() {
  echo
  log "GTM Platform is starting"
  echo "  API:       http://localhost:8000"
  echo "  API docs:  http://localhost:8000/docs"
  echo "  Web UI:    http://localhost:3000"
  echo "  Health:    http://localhost:8000/health"
  echo "  Logs:      $LOG_DIR/"
  echo
  echo "Stop with: make stop"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --infra|-i)
      START_APPS=false
      START_WORKERS=false
      ;;
    --apps|-a)
      START_INFRA=false
      ;;
    --workers|-w)
      START_WORKERS=true
      ;;
    --skip-install)
      SKIP_INSTALL=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1 (try --help)"
      ;;
  esac
  shift
done

if [[ "$START_INFRA" == true ]]; then
  start_infra
  ensure_install
  init_database
fi

if [[ "$START_APPS" == true ]]; then
  if [[ "$START_INFRA" == false ]]; then
    ensure_env
    ensure_install
  fi
  start_apps
fi

if [[ "$START_WORKERS" == true ]]; then
  ensure_install
  start_worker_process
fi

print_status
log "Done."
