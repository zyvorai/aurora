#!/usr/bin/env bash
# ============================================================================
# onboard-zyvor.sh — Onboard HyperSDK Platform (zyvor.dev) into Emissary and
# generate a lead-generation-focused GTM strategy + starter content.
#
# Emissary is Zyvor's own AI-powered GTM platform: point it at a product's
# website, it builds a RAG knowledge graph, then runs Marketing/Sales/
# Solution AI agents grounded in that content. This script onboards
# zyvor.dev itself as the first real product, using the conversion-focused
# pages built in the hypersdk-web repo this session (VMware/Nutanix exit,
# get-started selector, industry pages, why-zyvor, Zyvor Argus) as extra
# knowledge sources so the generated strategy/content is grounded in real,
# current site copy — not just the homepage.
#
# Prerequisites: `make start` running (api on :8000), curl, jq.
#
# Usage:
#   ./scripts/onboard-zyvor.sh                       # against local dev (localhost:8000)
#   API_BASE=https://emissary.zyvor.dev/api/v1 ./scripts/onboard-zyvor.sh   # against a live deployment
#
# What this does:
#   1. Logs in as the seeded default admin (marketing@zyvor.dev), or registers
#      a tenant if that account doesn't exist yet.
#   2. Creates a "HyperSDK Platform" product with website_url=https://zyvor.dev
#      (this auto-creates a WEBSITE source for the root site).
#   3. Adds extra WEBSITE sources for the highest-intent pages built this
#      session, so ingestion covers them specifically, not just whatever a
#      generic crawl of the homepage reaches.
#   4. Triggers ingestion (async) and waits for it to report done.
#   5. Generates a GTM strategy focused on lead generation.
#   6. Generates two starter content pieces (LinkedIn post, blog outline)
#      on the VMware-exit and Ask Zeus/AI-ops narratives.
#
# Nothing here calls the outreach/publish endpoints — those need explicit
# recipient targeting and Emissary's own human-approval gate before
# anything goes out, by design. This script only generates drafts.
# ============================================================================

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-marketing@zyvor.dev}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@321}"
SITE_URL="${SITE_URL:-https://zyvor.dev}"

info()  { echo "[onboard-zyvor] $*"; }
error() { echo "[onboard-zyvor] ERROR: $*" >&2; exit 1; }

command -v jq >/dev/null || error "jq is required (brew install jq)"
command -v curl >/dev/null || error "curl is required"

# ── 1. Auth ──────────────────────────────────────────────────────────────
info "Logging in as ${ADMIN_EMAIL}..."
LOGIN_RESP=$(curl -sf -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}") || {
  info "Login failed, attempting to register a new tenant..."
  LOGIN_RESP=$(curl -sf -X POST "${API_BASE}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_name\":\"Zyvor AI Labs\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"full_name\":\"Marketing\"}") \
    || error "register also failed — check API_BASE and that 'make start' is running"
}
TOKEN=$(echo "$LOGIN_RESP" | jq -r '.access_token')
[ "$TOKEN" != "null" ] && [ -n "$TOKEN" ] || error "no access_token in auth response: $LOGIN_RESP"
AUTH=(-H "Authorization: Bearer ${TOKEN}")
info "Authenticated."

# ── 2. Create (or find) the product ─────────────────────────────────────
info "Checking for an existing 'HyperSDK Platform' product..."
EXISTING_ID=$(curl -sf "${API_BASE}/products" "${AUTH[@]}" | jq -r '.[] | select(.name=="HyperSDK Platform") | .id' | head -1)

if [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "null" ]; then
  PRODUCT_ID="$EXISTING_ID"
  info "Found existing product ${PRODUCT_ID}, reusing it."
else
  info "Creating product 'HyperSDK Platform' (website_url=${SITE_URL})..."
  CREATE_RESP=$(curl -sf -X POST "${API_BASE}/products" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"HyperSDK Platform\",\"website_url\":\"${SITE_URL}\",\"description\":\"Enterprise VM migration and infrastructure platform — VMware/Nutanix exit, KubeVirt, AI/GPU infrastructure, edge and private cloud.\"}")
  PRODUCT_ID=$(echo "$CREATE_RESP" | jq -r '.id')
  [ "$PRODUCT_ID" != "null" ] || error "product creation failed: $CREATE_RESP"
  info "Created product ${PRODUCT_ID}."
fi

# ── 3. Add high-intent page sources ─────────────────────────────────────
# The root website_url source already exists (auto-created on product
# creation). Add the specific conversion pages so ingestion has dense
# coverage of them, not just whatever a shallow crawl reaches.
HIGH_INTENT_PAGES=(
  "${SITE_URL}/vmware-exit|VMware Exit"
  "${SITE_URL}/nutanix-exit|Nutanix Exit"
  "${SITE_URL}/why-zyvor|Why Zyvor"
  "${SITE_URL}/get-started|Get Started (solution selector)"
  "${SITE_URL}/roi|ROI Calculator"
  "${SITE_URL}/zyvor-argus|Zyvor Argus (MCP + Ask Zyvor)"
  "${SITE_URL}/forge|Forge (Ask Zeus AI ops)"
  "${SITE_URL}/industries|Industries"
)

info "Adding ${#HIGH_INTENT_PAGES[@]} high-intent page sources..."
for entry in "${HIGH_INTENT_PAGES[@]}"; do
  url="${entry%%|*}"
  name="${entry##*|}"
  curl -sf -X POST "${API_BASE}/products/${PRODUCT_ID}/sources" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"source_type\":\"website\",\"url\":\"${url}\",\"display_name\":\"${name}\"}" \
    > /dev/null || info "  (skipped ${url} — may already exist)"
done

# ── 4. Ingest ────────────────────────────────────────────────────────────
info "Triggering ingestion (async)..."
INGEST_RESP=$(curl -sf -X POST "${API_BASE}/products/${PRODUCT_ID}/ingest" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{"force": true, "async_mode": true}')
info "Ingestion queued: $(echo "$INGEST_RESP" | jq -c '.')"
info "Ingestion runs in the background — check the Emissary UI's product page for progress before generating strategy/content below."
read -rp "[onboard-zyvor] Press Enter once ingestion shows complete in the UI (or wait ~a few minutes for a small site)... "

# ── 5. Generate a lead-gen-focused GTM strategy ─────────────────────────
info "Generating GTM strategy (focus: lead generation, VMware exit, AI infrastructure)..."
STRATEGY_RESP=$(curl -sf -X POST "${API_BASE}/products/${PRODUCT_ID}/strategy" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{"focus_areas": ["lead generation", "VMware/Nutanix exit", "AI infrastructure", "AI-powered QA and MCP"]}')
echo "$STRATEGY_RESP" | jq -r '.gtm_strategy // .'
info "Strategy artifact id: $(echo "$STRATEGY_RESP" | jq -r '.artifact_id')"

# ── 6. Generate starter content ─────────────────────────────────────────
info "Generating LinkedIn post (VMware exit)..."
curl -sf -X POST "${API_BASE}/products/${PRODUCT_ID}/content" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{"content_type":"linkedin","topic":"Why VMware customers are exiting to open KVM after Broadcom'"'"'s licensing changes","tone":"professional","target_persona":"Infrastructure Head"}' \
  | jq -r '.'

info "Generating blog outline (Ask Zeus AI ops engineer)..."
curl -sf -X POST "${API_BASE}/products/${PRODUCT_ID}/content" "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d '{"content_type":"blog","topic":"What an approval-gated AI ops engineer actually does (Ask Zeus, inside Forge)","tone":"professional","target_persona":"Platform Engineer"}' \
  | jq -r '.'

info "Done. Generated artifacts need human approval before publishing — review them in the Emissary UI (Artifacts / Approve) before anything goes out."
