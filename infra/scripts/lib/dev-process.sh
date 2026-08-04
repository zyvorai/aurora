#!/usr/bin/env bash
# Shared helpers for gracefully stopping local dev processes (API, web, workers).

dev_log() { printf '==> %s\n' "$*"; }
dev_warn() { printf 'warning: %s\n' "$*" >&2; }

dev_port_pids() {
  local port="$1"
  lsof -ti tcp:"$port" 2>/dev/null || true
}

dev_wait_port_free() {
  local port="$1"
  local max_seconds="$2"
  local i=0
  while [[ $i -lt $max_seconds ]]; do
    if ! lsof -ti tcp:"$port" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

dev_signal_pgid() {
  local sig="$1"
  local pid="$2"
  [[ -z "$pid" ]] && return 0
  kill -0 "$pid" 2>/dev/null || return 0

  local pgid
  pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
  if [[ -n "$pgid" && "$pgid" =~ ^[0-9]+$ && "$pgid" -gt 1 ]]; then
    kill -"$sig" "-$pgid" 2>/dev/null || kill -"$sig" "$pid" 2>/dev/null || true
  else
    kill -"$sig" "$pid" 2>/dev/null || true
  fi
}

dev_collect_pids() {
  local pidfile="$1"
  shift
  local patterns=("$@")
  local collected=""

  if [[ -f "$pidfile" ]]; then
    local main_pid
    main_pid=$(tr -d '[:space:]' <"$pidfile" 2>/dev/null || true)
    if [[ -n "$main_pid" ]] && kill -0 "$main_pid" 2>/dev/null; then
      collected="$main_pid"
    fi
  fi

  local pattern pid
  for pattern in "${patterns[@]}"; do
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      if kill -0 "$pid" 2>/dev/null; then
        collected="$collected $pid"
      fi
    done < <(pgrep -f "$pattern" 2>/dev/null || true)
  done

  for pid in $collected; do
    [[ -n "$pid" ]] && echo "$pid"
  done | sort -u
}

dev_stop_by_port() {
  local root="$1"
  local port="$2"
  local name="$3"
  local pidfile="$4"
  shift 4
  local patterns=("$@")

  local port_pids
  port_pids=$(dev_port_pids "$port")
  local pids
  pids=$(dev_collect_pids "$pidfile" "${patterns[@]}")
  pids=$(printf '%s\n%s\n' "$pids" "$port_pids" | sort -u | grep -v '^$' || true)

  if [[ -z "${pids//[$'\n\r\t ']/}" ]]; then
    return 0
  fi

  local int_wait=15
  local term_wait=8
  if [[ "$port" == "3000" ]]; then
    int_wait=40
    term_wait=15
  fi

  dev_log "Stopping $name (SIGINT, up to ${int_wait}s)..."
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    if [[ "$port" == "3000" ]]; then
      dev_signal_pgid INT "$pid"
    else
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done <<< "$pids"

  if dev_wait_port_free "$port" "$int_wait"; then
    dev_log "$name stopped cleanly."
    rm -f "$pidfile" 2>/dev/null || true
    return 0
  fi

  dev_warn "$name still on port $port; sending SIGTERM..."
  pids=$(dev_collect_pids "$pidfile" "${patterns[@]}")
  port_pids=$(dev_port_pids "$port")
  pids=$(printf '%s\n%s\n' "$pids" "$port_pids" | sort -u | grep -v '^$' || true)
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    dev_signal_pgid TERM "$pid"
  done <<< "$pids"

  if dev_wait_port_free "$port" "$term_wait"; then
    rm -f "$pidfile" 2>/dev/null || true
    return 0
  fi

  if [[ "$port" == "3000" ]]; then
    dev_warn "Next.js still running; final SIGINT before force-kill..."
    pids=$(dev_collect_pids "$pidfile" "${patterns[@]}")
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      dev_signal_pgid INT "$pid"
    done <<< "$pids"
    if dev_wait_port_free "$port" 10; then
      rm -f "$pidfile" 2>/dev/null || true
      return 0
    fi
  fi

  dev_warn "Force-killing $name on port $port (close browser tab if it freezes)"
  port_pids=$(dev_port_pids "$port")
  if [[ -n "$port_pids" ]]; then
    kill -9 $port_pids 2>/dev/null || true
  fi
  for pattern in "${patterns[@]}"; do
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
  done
  rm -f "$pidfile" 2>/dev/null || true
}

dev_stop_api() {
  local root="$1"
  dev_stop_by_port "$root" 8000 "API (uvicorn)" "$root/.run/api.pid" \
    "uvicorn gtm_api.main:app"
}

dev_stop_web() {
  local root="$1"
  dev_stop_by_port "$root" 3000 "Web (Next.js)" "$root/.run/web.pid" \
    "next dev --port 3000" \
    "next dev" \
    "node.*next"
}

dev_stop_workers() {
  local root="$1"
  local patterns=("gtm_workers.main" "arq.worker")
  local pids
  pids=$(dev_collect_pids "$root/.run/workers.pid" "${patterns[@]}")
  [[ -z "${pids//[$'\n\r\t ']/}" ]] && return 0

  dev_log "Stopping background workers..."
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    kill -TERM "$pid" 2>/dev/null || true
  done <<< "$pids"

  sleep 3

  pids=$(dev_collect_pids "$root/.run/workers.pid" "${patterns[@]}")
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    dev_warn "Force-killing worker pid $pid"
    kill -9 "$pid" 2>/dev/null || true
  done <<< "$pids"
  rm -f "$root/.run/workers.pid" 2>/dev/null || true
}

dev_stop_all_apps() {
  local root="$1"
  # Stop Next.js first so HMR websockets close before API/workers disappear.
  dev_stop_web "$root"
  dev_stop_workers "$root"
  dev_stop_api "$root"
}
