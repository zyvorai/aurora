#!/usr/bin/env bash
# ============================================================================
# dedupe-lab-seed.sh — Remove duplicate seed sources (same URL) and duplicate
# opportunities (same name+company) for a product. Keeps the newest row.
#
# Usage:
#   API_BASE=https://175.110.122.71:30443/api/v1 CURL_OPTS=-k \
#     PRODUCT_ID=921530f5-0bb4-4b9a-b3b6-d6f53ccdace2 \
#     ./scripts/dedupe-lab-seed.sh
#   # All products:
#   API_BASE=... CURL_OPTS=-k ./scripts/dedupe-lab-seed.sh --all
# ============================================================================
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-marketing@zyvor.dev}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@321}"
CURL_OPTS="${CURL_OPTS:-}"
ALL=0
PRODUCT_ID="${PRODUCT_ID:-}"

for arg in "$@"; do
  case "$arg" in
    --all) ALL=1 ;;
  esac
done

CURL_BIN="${CURL_BIN:-$(command -v curl)}"
JQ_BIN="${JQ_BIN:-$(command -v jq)}"

# shellcheck disable=SC2086
LOGIN=$("$CURL_BIN" -sf $CURL_OPTS -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
TOKEN=$(echo "$LOGIN" | "$JQ_BIN" -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

# shellcheck disable=SC2086
api() {
  local method="$1"; shift
  local path="$1"; shift
  "$CURL_BIN" -sf $CURL_OPTS -X "$method" "${API_BASE}${path}" \
    -H "Content-Type: application/json" \
    "${AUTH[@]}" "$@"
}

dedupe_product() {
  local pid="$1"
  echo "[dedupe] ${pid}"

  local sources
  sources=$(api GET "/products/${pid}/sources")
  echo "$sources" | "$JQ_BIN" -r '
    group_by(.url)[]
    | sort_by(.updated_at // .created_at // "") | reverse
    | .[1:][]
    | .id
  ' | while read -r sid; do
    [ -z "$sid" ] && continue
    echo "  delete source ${sid}"
    api DELETE "/products/${pid}/sources/${sid}" || true
  done

  local opps
  opps=$(api GET "/products/${pid}/opportunities")
  echo "$opps" | "$JQ_BIN" -r '
    group_by([.name, .company])[]
    | sort_by(.updated_at // .created_at // "") | reverse
    | .[1:][]
    | .id
  ' | while read -r oid; do
    [ -z "$oid" ] && continue
    echo "  delete opportunity ${oid}"
    api DELETE "/products/${pid}/opportunities/${oid}" || true
  done
}

if [ "$ALL" = "1" ]; then
  api GET /products | "$JQ_BIN" -r '.[].id' | while read -r pid; do
    dedupe_product "$pid"
  done
else
  [ -n "$PRODUCT_ID" ] || { echo "PRODUCT_ID required (or pass --all)" >&2; exit 1; }
  dedupe_product "$PRODUCT_ID"
fi

echo "[dedupe] done"
