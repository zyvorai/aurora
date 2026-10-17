#!/usr/bin/env bash
# Aurora easy-test PoC installer and helper (macOS + Linux).
#
#   curl -fsSL https://zyvorai.github.io/aurora/install.sh | bash          # install and start
#   ~/.aurora-poc/aurora-poc status|logs|down|up|update|reset|feedback|uninstall
#
# Environment (all optional):
#   AURORA_POC_DIR   install dir (default ~/.aurora-poc)       AURORA_VERSION   image tag (default latest)
#   AURORA_PORT      web port (default 3000)                    AURORA_LLM       openai | ollama | skip (skips the prompt)
#   OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL             used when AURORA_LLM=openai
#   AURORA_BASE_URL  where docker-compose.poc.yml is fetched    AURORA_COMPOSE_FILE  use a local compose file instead
set -euo pipefail

DIR="${AURORA_POC_DIR:-$HOME/.aurora-poc}"
BASE_URL="${AURORA_BASE_URL:-https://zyvorai.github.io/aurora}"
PORT="${AURORA_PORT:-3000}"
REPO_ISSUES="https://github.com/zyvorai/aurora/issues/new"
cmd="${1:-install}"

say()  { printf '\033[1m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33mwarning:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

compose() { (cd "$DIR" && docker compose -f docker-compose.poc.yml "$@"); }

need_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker is not installed.
  macOS:  install Docker Desktop (https://www.docker.com/products/docker-desktop) or 'brew install --cask docker'
  Linux:  https://docs.docker.com/engine/install/ (then add yourself to the docker group)"
  docker info >/dev/null 2>&1 || die "Docker is installed but not running (or you lack permission). Start Docker Desktop / the docker service and retry."
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required ('docker compose'). Update Docker."
}

rand_hex() { openssl rand -hex "${1:-24}" 2>/dev/null || head -c "${1:-24}" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

set_env() { # set_env KEY VALUE  (idempotent, never echoes secrets)
  local k="$1" v="$2" f="$DIR/.env"
  touch "$f"; chmod 600 "$f"
  if grep -q "^${k}=" "$f"; then
    tmp="$(mktemp)"; grep -v "^${k}=" "$f" > "$tmp"; cat "$tmp" > "$f"; rm -f "$tmp"
  fi
  printf '%s=%s\n' "$k" "$v" >> "$f"
}
have_env() { grep -q "^$1=" "$DIR/.env" 2>/dev/null; }

fetch_compose() {
  mkdir -p "$DIR"
  if [ -n "${AURORA_COMPOSE_FILE:-}" ]; then cp "$AURORA_COMPOSE_FILE" "$DIR/docker-compose.poc.yml"
  else
    curl -fsSL "$BASE_URL/docker-compose.poc.yml" -o "$DIR/docker-compose.poc.yml" 2>/dev/null \
      || curl -fsSL "https://raw.githubusercontent.com/zyvorai/aurora/main/docker-compose.poc.yml" -o "$DIR/docker-compose.poc.yml" \
      || die "could not download docker-compose.poc.yml from $BASE_URL or GitHub"
  fi
}

choose_llm() {
  have_env LLM_PROVIDER && return 0
  local choice="${AURORA_LLM:-}"
  if [ -z "$choice" ] && [ -r /dev/tty ]; then
    printf '\nAurora needs an LLM for its agents. Choose:\n  1) OpenAI-compatible API key (OpenAI, Groq, Azure, ...)\n  2) Ollama already running on this computer\n  3) Skip for now (the UI works; agents will report "LLM not configured")\n> ' > /dev/tty
    read -r ans < /dev/tty || ans=3
    case "$ans" in 1) choice=openai ;; 2) choice=ollama ;; *) choice=skip ;; esac
  fi
  case "${choice:-skip}" in
    openai)
      local key="${OPENAI_API_KEY:-}"
      if [ -z "$key" ] && [ -r /dev/tty ]; then printf 'API key (input hidden): ' > /dev/tty; read -rs key < /dev/tty; printf '\n' > /dev/tty; fi
      [ -n "$key" ] || die "no API key given"
      set_env LLM_PROVIDER openai; set_env OPENAI_API_KEY "$key"
      [ -n "${OPENAI_BASE_URL:-}" ] && set_env OPENAI_BASE_URL "$OPENAI_BASE_URL"
      [ -n "${OPENAI_MODEL:-}" ] && { set_env OPENAI_MODEL "$OPENAI_MODEL"; set_env LLM_SINGLE_MODEL "$OPENAI_MODEL"; } ;;
    ollama)
      set_env LLM_PROVIDER ollama
      set_env OLLAMA_BASE_URL "http://host.docker.internal:11434/v1"
      set_env OLLAMA_DEFAULT_MODEL "${OLLAMA_MODEL:-llama3.1:8b}"; set_env LLM_SINGLE_MODEL "${OLLAMA_MODEL:-llama3.1:8b}"
      set_env OLLAMA_EMBEDDING_MODEL nomic-embed-text; set_env OLLAMA_EMBEDDING_DIMENSIONS 768
      warn "Make sure Ollama listens for Docker (OLLAMA_HOST=0.0.0.0) and has the models: ollama pull llama3.1:8b && ollama pull nomic-embed-text" ;;
    *) set_env LLM_PROVIDER ollama; warn "LLM skipped - run '$DIR/aurora-poc llm' later or edit $DIR/.env" ;;
  esac
}

install_self() {
  local self="${BASH_SOURCE[0]:-}"
  if [ -n "$self" ] && [ -f "$self" ] && [ "$(cd "$(dirname "$self")" && pwd)/$(basename "$self")" != "$DIR/aurora-poc" ]; then
    cp "$self" "$DIR/aurora-poc"
  else
    curl -fsSL "$BASE_URL/install.sh" -o "$DIR/aurora-poc" 2>/dev/null \
      || curl -fsSL "https://raw.githubusercontent.com/zyvorai/aurora/main/scripts/poc/install.sh" -o "$DIR/aurora-poc" 2>/dev/null || true
  fi
  chmod +x "$DIR/aurora-poc" 2>/dev/null || true
}

open_url() {
  case "$(uname -s)" in Darwin) open "$1" >/dev/null 2>&1 || true ;; Linux) command -v xdg-open >/dev/null && xdg-open "$1" >/dev/null 2>&1 || true ;; esac
}

wait_healthy() {
  say "Waiting for Aurora to become healthy (first start pulls images - a few minutes)"
  for _ in $(seq 1 180); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/login" 2>/dev/null && curl -fsS -o /dev/null "http://127.0.0.1:${AURORA_API_PORT:-8000}/health" 2>/dev/null; then return 0; fi
    sleep 3
  done
  warn "Not healthy yet. Check:  $DIR/aurora-poc logs"; return 1
}

banner() {
  cat <<EOF

  Aurora is running.

    Open:    http://localhost:${PORT}
    Sign in: marketing@zyvor.dev   /   Admin@321     (demo account - change it if this is more than a throwaway test)

    Manage:  $DIR/aurora-poc status | logs | down | up | update | reset | feedback | uninstall
    Tell us how it went:  $DIR/aurora-poc feedback

EOF
}

case "$cmd" in
  install|up)
    need_docker
    [ "$cmd" = install ] && { fetch_compose; mkdir -p "$DIR"; have_env SECRET_KEY || set_env SECRET_KEY "$(rand_hex 32)"; have_env POSTGRES_PASSWORD || set_env POSTGRES_PASSWORD "$(rand_hex 16)"
      [ -n "${AURORA_VERSION:-}" ] && set_env AURORA_VERSION "$AURORA_VERSION"; set_env AURORA_PORT "$PORT"; choose_llm; install_self; }
    say "Starting Aurora"
    compose up -d --wait --wait-timeout 600 || warn "compose reported a problem; continuing to health check"
    wait_healthy && { banner; [ -z "${AURORA_NO_OPEN:-}" ] && open_url "http://localhost:${PORT}"; } ;;
  down)      need_docker; compose down ;;
  status)    need_docker; compose ps; curl -fsS "http://127.0.0.1:${AURORA_API_PORT:-8000}/health" || true; echo ;;
  logs)      need_docker; compose logs -f --tail=100 "${2:-}" ;;
  update)    need_docker; compose pull; compose up -d --wait --wait-timeout 600 ;;
  llm)       need_docker; grep -v '^LLM_PROVIDER=' "$DIR/.env" > "$DIR/.env.tmp" && cat "$DIR/.env.tmp" > "$DIR/.env"; rm -f "$DIR/.env.tmp"; choose_llm; compose up -d api ;;
  reset)     need_docker; printf 'This deletes ALL Aurora PoC data (database, vectors). Type "reset" to continue: '; read -r a </dev/tty; [ "$a" = reset ] && { compose down -v; compose up -d --wait --wait-timeout 600; } ;;
  feedback)
    ver="$(curl -fsS "http://127.0.0.1:${AURORA_API_PORT:-8000}/health" 2>/dev/null | head -c 600 || echo unavailable)"
    url="$REPO_ISSUES?template=poc-feedback.yml&title=PoC%20feedback&os=$(uname -s)"
    say "Opening the feedback form: $url"; printf 'Health output to paste if useful:\n%s\n' "$ver"; open_url "$url" ;;
  uninstall) need_docker; printf 'Remove Aurora PoC containers, data and %s? Type "uninstall": ' "$DIR"; read -r a </dev/tty; [ "$a" = uninstall ] && { compose down -v || true; rm -rf "$DIR"; say "Removed."; } ;;
  *) die "unknown command '$cmd' (install|up|down|status|logs|update|llm|reset|feedback|uninstall)" ;;
esac
