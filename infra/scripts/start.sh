#!/usr/bin/env bash
# Start GTM Platform dev environment (infra + API + web + workers when enabled).
#
# Usage:
#   ./infra/scripts/start.sh              # full start: infra, db init, api + web + workers (if .env allows)
#   ./infra/scripts/start.sh --infra        # docker compose only
#   ./infra/scripts/start.sh --apps         # api + web only (infra must be running)
#   ./infra/scripts/start.sh --workers      # force-start ARQ background workers
#   ./infra/scripts/start.sh --no-workers   # skip workers even when ENABLE_REDIS_WORKERS=true
#   ./infra/scripts/start.sh --skip-install # skip pip/npm install checks
#   ./infra/scripts/start.sh --help

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker-compose.yml"
VENV="$ROOT/apps/api/.venv"
LOG_DIR="$ROOT/.logs"
PID_DIR="$ROOT/.run"
# shellcheck source=lib/dev-process.sh
source "$ROOT/infra/scripts/lib/dev-process.sh"

START_INFRA=true
START_APPS=true
START_WORKERS=""  # empty = auto from .env; true/false = explicit
SKIP_INSTALL=false

usage() {
  sed -n '2,10p' "$0" | sed 's/^# \?//'
}

log() { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# True when DEPLOYMENT_PROFILE is not minimal and ENABLE_REDIS_WORKERS is not false.
workers_enabled_in_env() {
  local env_file="$ROOT/.env"
  local deployment="full"
  local enable_workers="true"

  if [[ -f "$env_file" ]]; then
    local line key value
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%%#*}"
      line="${line#"${line%%[![:space:]]*}"}"
      line="${line%"${line##*[![:space:]]}"}"
      [[ -z "$line" || "$line" != *=* ]] && continue
      key="${line%%=*}"
      value="${line#*=}"
      value="${value%\"}"
      value="${value#\"}"
      value="${value%\'}"
      value="${value#\'}"
      case "$key" in
        DEPLOYMENT_PROFILE) deployment="$value" ;;
        ENABLE_REDIS_WORKERS) enable_workers="$value" ;;
      esac
    done < "$env_file"
  fi

  deployment=$(printf '%s' "$deployment" | tr '[:upper:]' '[:lower:]')
  enable_workers=$(printf '%s' "$enable_workers" | tr '[:upper:]' '[:lower:]')

  [[ "$deployment" == "minimal" ]] && return 1
  case "$enable_workers" in
    false|0|no|off) return 1 ;;
  esac
  return 0
}

resolve_start_workers() {
  if [[ -n "$START_WORKERS" ]]; then
    return 0
  fi
  ensure_env
  if workers_enabled_in_env; then
    START_WORKERS=true
  else
    START_WORKERS=false
  fi
}

port_in_use() {
  lsof -ti tcp:"$1" >/dev/null 2>&1
}

require_docker() {
  command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker Desktop."
  docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker Desktop first."
}

sync_web_env() {
  local web_env="$ROOT/apps/web/.env.local"
  if [[ -f "$ROOT/.env" ]]; then
    grep '^NEXT_PUBLIC_' "$ROOT/.env" >"$web_env" 2>/dev/null || true
    if [[ -s "$web_env" ]]; then
      log "Synced NEXT_PUBLIC_* to apps/web/.env.local"
    fi
  fi
  if [[ ! -f "$web_env" ]] || [[ ! -s "$web_env" ]]; then
    echo 'NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1' >"$web_env"
    log "Created apps/web/.env.local with default API URL"
  fi
}

ensure_env() {
  if [[ ! -f "$ROOT/.env" ]]; then
    log "Creating .env from .env.example"
    cp "$ROOT/.env.example" "$ROOT/.env"
  fi
  sync_web_env
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

run_migrations() {
  [[ -x "$VENV/bin/alembic" ]] || return 0
  log "Applying Alembic migrations..."
  (
    cd "$ROOT/apps/api"
    # DBs created via init_db.py may lack alembic_version — stamp wave4 baseline first.
    if ! .venv/bin/alembic current 2>/dev/null | grep -qE '[0-9a-f]+_(wave|source)'; then
      .venv/bin/alembic stamp 005_wave4_success 2>/dev/null || true
    fi
    .venv/bin/alembic upgrade head
  )
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
    if [[ "$name" == "web" ]] && command -v setsid >/dev/null 2>&1; then
      # Own session → SIGINT to process group shuts down Next.js HMR cleanly on make stop.
      setsid nohup "$@" >>"$logfile" 2>&1 &
    else
      nohup "$@" >>"$logfile" 2>&1 &
    fi
    echo $! >"$pidfile"
  )
  log "$name started (pid $(cat "$pidfile"), log: $logfile)"
}

start_apps() {
  ensure_install

  if port_in_use 8000; then
    if pgrep -f "uvicorn gtm_api.main:app" >/dev/null 2>&1; then
      log "Restarting API on port 8000 (pick up code changes)..."
      dev_stop_api "$ROOT"
      rm -f "$PID_DIR/api.pid"
    else
      warn "Port 8000 in use by another process — API not started"
    fi
  fi

  if ! port_in_use 8000; then
    start_background "api" "$ROOT/apps/api" \
      "$VENV/bin/uvicorn" gtm_api.main:app --host 127.0.0.1 --port 8000
  fi

  if port_in_use 3000; then
    if pgrep -f "next dev" >/dev/null 2>&1; then
      log "Restarting web on port 3000 (pick up code changes)..."
      dev_stop_web "$ROOT"
      rm -f "$PID_DIR/web.pid"
      rm -rf "$ROOT/apps/web/.next"
    else
      warn "Port 3000 in use by another process — web not started"
    fi
  fi

  if ! port_in_use 3000; then
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
  if [[ "$START_WORKERS" == true ]]; then
    if [[ -f "$PID_DIR/workers.pid" ]] && kill -0 "$(cat "$PID_DIR/workers.pid")" 2>/dev/null; then
      echo "  Workers:   running (async source ingest enabled) — tail -f $LOG_DIR/workers.log"
    else
      echo "  Workers:   starting — tail -f $LOG_DIR/workers.log"
    fi
  else
    echo "  Workers:   not running"
    echo "             Source ingest via “Ingest selected” needs workers: make workers"
    echo "             Or use “Crawl & Ingest” on Forge Overview (sync, no workers)."
  fi
  echo
  echo "  Ingest status in UI: pending → crawling → processing → completed (or failed)"
  echo
  echo "Stop with: make stop   (close localhost:3000 tabs first to avoid browser hangs)"
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
    --no-workers)
      START_WORKERS=false
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

resolve_start_workers

if [[ "$START_INFRA" == true ]]; then
  start_infra
  ensure_install
  init_database
  run_migrations
fi

if [[ "$START_APPS" == true ]]; then
  if [[ "$START_INFRA" == false ]]; then
    ensure_env
    ensure_install
    run_migrations
  fi
  start_apps
fi

if [[ "$START_WORKERS" == true ]]; then
  ensure_install
  start_worker_process
fi

print_status
log "Done."
