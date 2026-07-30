#!/usr/bin/env bash
# Stop GTM Platform dev processes and Docker infrastructure.
#
# Usage:
#   ./infra/scripts/stop.sh              # stop app processes + docker compose
#   ./infra/scripts/stop.sh --processes  # stop uvicorn/next/workers only
#   ./infra/scripts/stop.sh --infra      # stop docker compose only
#   ./infra/scripts/stop.sh --clean      # stop everything + remove docker volumes
#   ./infra/scripts/stop.sh --help

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker-compose.yml"

STOP_PROCESSES=true
STOP_INFRA=true
REMOVE_VOLUMES=false

usage() {
  sed -n '2,7p' "$0" | sed 's/^# \?//'
}

log() { printf '==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }

stop_processes() {
  log "Stopping local dev processes..."

  # Graceful stop by port (API + web)
  for port in 8000 3000; do
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      log "Stopping process(es) on port $port: $pids"
      kill $pids 2>/dev/null || true
    fi
  done

  # Fallback: match known dev commands from this repo
  patterns=(
    "uvicorn gtm_api.main:app"
    "next dev"
    "gtm_workers.main"
    "arq.worker"
  )
  for pattern in "${patterns[@]}"; do
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      log "Stopping '$pattern': $pids"
      kill $pids 2>/dev/null || true
    fi
  done

  sleep 1

  # Force kill anything still listening
  for port in 8000 3000; do
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      warn "Force-killing process(es) still on port $port: $pids"
      kill -9 $pids 2>/dev/null || true
    fi
  done

  if [[ -d "$ROOT/.run" ]]; then
    rm -f "$ROOT/.run"/*.pid 2>/dev/null || true
  fi
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
