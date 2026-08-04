#!/usr/bin/env bash
# Stop GTM Platform dev processes and Docker infrastructure.
#
# Usage:
#   ./infra/scripts/stop.sh              # stop app processes + docker compose
#   ./infra/scripts/stop.sh --processes  # stop uvicorn/next/workers only (keeps Docker)
#   ./infra/scripts/stop.sh --infra      # stop docker compose only
#   ./infra/scripts/stop.sh --clean      # stop everything + remove docker volumes
#   ./infra/scripts/stop.sh --help
#
# Tip: close http://localhost:3000 browser tabs before stopping to avoid tab freezes
# (Next.js HMR websocket). Use: make stop-apps to stop processes but leave Docker up.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker-compose.yml"
# shellcheck source=lib/dev-process.sh
source "$ROOT/infra/scripts/lib/dev-process.sh"

STOP_PROCESSES=true
STOP_INFRA=true
REMOVE_VOLUMES=false

usage() {
  sed -n '2,7p' "$0" | sed 's/^# \?//'
}

log() { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }

stop_processes() {
  log "Stopping local dev processes (graceful shutdown)..."
  if lsof -ti tcp:3000 >/dev/null 2>&1; then
    warn "Next.js detected on :3000 — close that browser tab, then waiting 3s..."
    sleep 3
  fi
  dev_stop_all_apps "$ROOT"
  warn "If a localhost:3000 tab freezes, close that tab (Cmd+W) — do not wait for reload."
}

stop_infra() {
  if ! command -v docker >/dev/null 2>&1; then
    warn "docker not found; skipping infrastructure stop"
    return 0
  fi
  if ! docker info >/dev/null 2>&1; then
    warn "docker daemon not running; skipping infrastructure stop"
    return 0
  fi

  if [[ "$REMOVE_VOLUMES" == true ]]; then
    log "Stopping Docker services and removing volumes..."
    docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
    log "All data volumes removed (Postgres, Qdrant, Neo4j, Redis, MinIO, Ollama)."
  else
    log "Stopping Docker services (data volumes preserved)..."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --processes|-p)
      STOP_INFRA=false
      ;;
    --infra|-i)
      STOP_PROCESSES=false
      ;;
    --clean|-c)
      REMOVE_VOLUMES=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ "$STOP_PROCESSES" == true ]]; then
  stop_processes
fi

if [[ "$STOP_INFRA" == true ]]; then
  stop_infra
fi

log "Done."
