#!/usr/bin/env bash
# ============================================================================
# seed-zyvor-suite.sh — Seed Aurora with Zyvor suite products from zyvor.dev,
# sales CRM opportunities, and customer-mail follow-up drafts.
#
# Usage:
#   API_BASE=https://175.110.122.71:30443/api/v1 CURL_OPTS=-k \
#     ./scripts/seed-zyvor-suite.sh
#
# Env:
#   API_BASE          default http://localhost:8000/api/v1
#   CURL_OPTS         e.g. -k for self-signed TLS
#   ADMIN_EMAIL / ADMIN_PASSWORD
#   SITE_URL          default https://zyvor.dev
#   SKIP_INGEST=1     skip crawl/ingest
#   SKIP_OUTREACH=1   skip mail follow-up generation
#   WAIT_INGEST_SEC   seconds to poll ingest (default 180, 0 = fire-and-forget)
# ============================================================================

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000/api/v1}"
ADMIN_EMAIL="${ADMIN_EMAIL:-marketing@zyvor.dev}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@321}"
SITE_URL="${SITE_URL:-https://zyvor.dev}"
CURL_OPTS="${CURL_OPTS:-}"
SKIP_INGEST="${SKIP_INGEST:-0}"
SKIP_OUTREACH="${SKIP_OUTREACH:-0}"
WAIT_INGEST_SEC="${WAIT_INGEST_SEC:-180}"

info()  { echo "[seed-zyvor] $*"; }
warn()  { echo "[seed-zyvor] WARNING: $*" >&2; }
error() { echo "[seed-zyvor] ERROR: $*" >&2; exit 1; }

command -v jq >/dev/null || error "jq is required"
command -v curl >/dev/null || error "curl is required"

# Prefer absolute tools — some shells alias curl/grep and break PATH mid-script.
CURL_BIN="${CURL_BIN:-$(command -v curl)}"
JQ_BIN="${JQ_BIN:-$(command -v jq)}"
HEAD_BIN="${HEAD_BIN:-$(command -v head)}"

# shellcheck disable=SC2086
api() {
  local method="$1"; shift
  local path="$1"; shift
  "$CURL_BIN" -sf $CURL_OPTS -X "$method" "${API_BASE}${path}" \
    -H "Content-Type: application/json" \
    "${AUTH[@]+"${AUTH[@]}"}" \
    "$@"
}

# ── Suite catalog (product page + docs + CRM prospect) ───────────────────
# name|website_path|docs_path|description|prospect_company_url|persona|opp_name|opp_company|opp_amount
PRODUCTS=(
  "Axiom|/axiom|/docs/axiom|k8s-native private cloud control plane (k3s → production)|https://zyvor.dev/axiom|Platform / Infra Head|Axiom private-cloud eval|Acme Cloud Ops|75000"
  "Aurora|/aurora|/docs/aurora|AI go-to-market agents grounded in your product|https://zyvor.dev/aurora|VP Marketing|Aurora GTM pilot|Northwind SaaS|45000"
  "Forge|/forge|/docs/forge|Kubernetes-native AI / GPU infrastructure|https://zyvor.dev/forge|AI Platform Lead|Forge GPU fabric PoC|Vertex Labs|120000"
  "Ragnarok|/ragnarok|/docs/ragnarok|Confidential computing & disposable VMs|https://zyvor.dev/ragnarok|CISO / Security|Ragnarok confidential VM trial|Harbor Bank|90000"
  "Haven|/haven|/docs/haven|Identity plane for Keycloak|https://zyvor.dev/haven|Identity Architect|Haven IdP consolidation|Contoso Identity|35000"
  "Zeus OS|/zeus-os|/docs/zeus-os|Visual KubeVirt/VM command center — web dashboard + Rust TUI, cost, consoles, incident response|https://zyvor.dev/zeus-os|Platform / SRE Lead|Zeus OS KubeVirt control plane eval|Meridian Cloud|60000"
  "Atlas|/atlas|/docs/atlas|One storage API for the whole Zyvor suite — Ceph, NFS, or ZFS, with inventory and audit trail|https://zyvor.dev/atlas|Platform / Storage Lead|Atlas storage abstraction eval|Helix Data|55000"
  "Chimera|/chimera|/docs/chimera|Apache-2.0 vSphere persona simulator for Transiva export, OVF, and NFC labs, no physical vCenter|https://zyvor.dev/chimera|QA / Migration Engineer|Chimera vSphere lab simulator|Vantage Systems|20000"
  "Ephemera|/ephemera|/docs/ephemera|On-demand VMs for minutes not days, across QEMU/KVM, Cloud Hypervisor, and Firecracker|https://zyvor.dev/ephemera|Platform Engineer|Ephemera on-demand VM pilot|Nimbus Labs|40000"
  "GuestKit|/guestkit|/docs/guestkit|Pure-Rust VM disk toolkit — inspect, analyze, and fix VM disks without booting them, AI-powered diagnostics|https://zyvor.dev/guestkit|SRE / Migration Lead|GuestKit disk diagnostics eval|Redline Systems|30000"
  "H2KVM|/h2kvm|/docs/h2kvm|Any hypervisor to KVM — convert disks with automated guest fixing and first-boot validation|https://zyvor.dev/h2kvm|Infrastructure Migration Lead|H2KVM hypervisor migration PoC|Beacon Health IT|85000"
  "Hermes|/hermes|/docs/hermes|Auto-discover every service on your cluster, LLM-powered insights, shared launchpad|https://zyvor.dev/hermes|Platform Ops Lead|Hermes cluster insight rollout|Lumen Retail|50000"
  "Hypercluster|/hypercluster|/docs/hypercluster|Stand up production Kubernetes clusters without hand-building nodes — Kubespray automation over SSH|https://zyvor.dev/hypercluster|Infra Automation Lead|Hypercluster bare-metal bootstrap|Fortress Manufacturing|70000"
  "IronWolf|/ironwolf|/docs/ironwolf|Kubernetes operator for bare metal lifecycle management — Metal3-aligned fleet policy, multi-protocol BMC drivers|https://zyvor.dev/ironwolf|Data Center Ops Lead|IronWolf fleet lifecycle eval|Summit Colo|65000"
  "Machina|/machina|/docs/machina|Linux hypervisor control plane for QEMU/KVM under libvirt and KubeVirt — Rust daemon, fleet controller, Zyra AI ops|https://zyvor.dev/machina|Virtualization Lead|Machina fleet cloud pilot|Cascade Systems|95000"
  "PacketWolf|/packetwolf|/docs/packetwolf|See which process made every network connection on your Cilium cluster, turn visibility into automatic policy|https://zyvor.dev/packetwolf|Security / NetOps Lead|PacketWolf policy automation trial|Blue Ridge Financial|55000"
  "Veyron|/veyron|/docs/veyron|Build, validate, and deploy KubeVirt VMs from YAML — 42 OS templates, GitOps operator|https://zyvor.dev/veyron|Platform Engineer|Veyron GitOps VM rollout|Orbital Media|40000"
  "Zyvor Argus|/zyvor-argus|/docs/zyvor-argus|Autonomous software assurance MCP server — conversational QA jobs, RAG Q&A, LangGraph specs to Playwright|https://zyvor.dev/zyvor-argus|QA Engineering Lead|Argus autonomous QA pilot|Pinecrest SaaS|30000"
  "Zyvor Fabric|/zyvor-fabric|/docs/zyvor-fabric|Enterprise VM management on Ephemera, no libvirt — CLI, TUI, web console, K8s operator, Terraform provider|https://zyvor.dev/zyvor-fabric|Cloud Platform Lead|Zyvor Fabric VM management eval|Alderwood Cloud|60000"
  "Zyvor Janus|/zyvor-janus|/docs/zyvor-janus|Discrete-event GPU cluster simulator for Forge — MIG, topology, quotas, gang scheduling, no physical GPUs|https://zyvor.dev/zyvor-janus|AI Infra Lead|Janus GPU simulation eval|Quanta AI|45000"
  "ZySign|/zysign|/docs/zysign|Sign India's mandatory MCA company filings from your Mac's browser with a USB signing device, nothing leaves your machine|https://zyvor.dev/zysign|Company Secretary / Compliance|ZySign MCA filing rollout|Kalyan Textiles|15000"
  "Zyvor Relay|/zyvor-relay|/docs/zyvor-relay|Accept, Notify, Ack, Act, Verify — durable events, transactional outbox, idempotent actions for edge and on-prem ops|https://zyvor.dev/zyvor-relay|Platform / Integrations Lead|Zyvor Relay event pipeline eval|Trailhead Logistics|50000"
  "Fleet Cloud|/fleet-cloud|/docs/fleet-cloud|Machina Fleet Cloud — pure-Rust private-cloud control plane for libvirt/KVM, instances/networks/volumes/load balancers|https://zyvor.dev/fleet-cloud|Private Cloud Lead|Fleet Cloud private-cloud pilot|Ridgeline Bank|80000"
)

# ── 1. Auth ──────────────────────────────────────────────────────────────
info "Auth → ${API_BASE} as ${ADMIN_EMAIL}"
# shellcheck disable=SC2086
LOGIN_RESP=$("$CURL_BIN" -sf $CURL_OPTS -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}") || {
  info "Login failed — registering Zyvor tenant..."
  # shellcheck disable=SC2086
  LOGIN_RESP=$("$CURL_BIN" -sf $CURL_OPTS -X POST "${API_BASE}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"tenant_name\":\"Zyvor\",\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"full_name\":\"Marketing\"}") \
    || error "auth failed"
}
TOKEN=$(echo "$LOGIN_RESP" | "$JQ_BIN" -r '.access_token')
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || error "no access_token"
AUTH=(-H "Authorization: Bearer ${TOKEN}")
info "Authenticated."

ensure_product() {
  local name="$1" url="$2" desc="$3"
  local existing
  existing=$(api GET /products | "$JQ_BIN" -r --arg n "$name" '.[] | select(.name==$n) | .id' | "$HEAD_BIN" -1)
  if [ -n "$existing" ] && [ "$existing" != "null" ]; then
    echo "$existing"
    return
  fi
  api POST /products -d "$("$JQ_BIN" -n \
    --arg name "$name" --arg url "$url" --arg desc "$desc" \
    '{name:$name, website_url:$url, description:$desc}')" | "$JQ_BIN" -r '.id'
}

add_source() {
  local pid="$1" url="$2" label="$3"
  local existing
  existing=$(api GET "/products/${pid}/sources" | "$JQ_BIN" -r --arg u "$url" \
    '.[] | select((.url // "") == $u) | .id' | "$HEAD_BIN" -1)
  if [ -n "$existing" ] && [ "$existing" != "null" ]; then
    info "  source exists: ${label}"
    return 0
  fi
  api POST "/products/${pid}/sources" -d "$("$JQ_BIN" -n \
    --arg url "$url" --arg name "$label" \
    '{source_type:"website", url:$url, display_name:$name}')" >/dev/null 2>&1 \
    || true
}

wait_ingest() {
  local pid="$1"
  local deadline=$((SECONDS + WAIT_INGEST_SEC))
  [ "$WAIT_INGEST_SEC" -le 0 ] && return 0
  info "  waiting up to ${WAIT_INGEST_SEC}s for ingest…"
  while [ $SECONDS -lt $deadline ]; do
    local pending
    pending=$(api GET "/products/${pid}/sources" | "$JQ_BIN" '[.[] | select((.status // .ingest_status // "") == "pending" or (.status // .ingest_status // "") == "crawling" or (.status // .ingest_status // "") == "processing" or (.status // .ingest_status // "") == "running")] | length' 2>/dev/null || echo 0)
    local statuses
    statuses=$(api GET "/products/${pid}/sources" | "$JQ_BIN" -r '.[].status // .[].ingest_status // "unknown"' 2>/dev/null | /usr/bin/sort -u | /usr/bin/tr '\n' ',' || true)
    if [ "${pending:-1}" = "0" ]; then
      info "  ingest settled (${statuses%,})"
      return 0
    fi
    /bin/sleep 5
  done
  warn "  ingest still running — continuing anyway"
}

create_opportunity() {
  local pid="$1" name="$2" company="$3" amount="$4"
  local existing
  existing=$(api GET "/products/${pid}/opportunities" | "$JQ_BIN" -r --arg n "$name" --arg c "$company" \
    '.[] | select(.name==$n and .company==$c) | .id' | "$HEAD_BIN" -1)
  if [ -n "$existing" ] && [ "$existing" != "null" ]; then
    info "  opportunity exists: ${name}"
    echo "$("$JQ_BIN" -nc --arg id "$existing" --arg name "$name" --arg company "$company" --argjson amount "$amount" \
      '{id:$id, name:$name, company:$company, stage:"discovery", amount:$amount}')"
    return 0
  fi
  api POST "/products/${pid}/opportunities" -d "$("$JQ_BIN" -n \
    --arg name "$name" --arg company "$company" --argjson amount "$amount" \
    '{name:$name, company:$company, stage:"discovery", amount:$amount, metadata:{source:"seed-zyvor-suite"}}')" \
    | "$JQ_BIN" -c '{id, name, company, stage, amount}'
}

generate_outreach() {
  local pid="$1" company_url="$2" persona="$3" campaign="$4"
  api POST "/products/${pid}/outreach" -d "$("$JQ_BIN" -n \
    --arg url "$company_url" --arg persona "$persona" --arg camp "$campaign" \
    '{company_url:$url, target_persona:$persona, campaign_name:$camp}')" \
    | "$JQ_BIN" -c '{artifact_id, company_name, follow_ups:(.follow_up_sequence|length), email_preview:(.email_draft|.[0:120])}'
}

# ── 2–5. Per-product seed ────────────────────────────────────────────────
CREATED=()
for row in "${PRODUCTS[@]}"; do
  IFS='|' read -r NAME PATH DOCS DESC PROSPECT PERSONA OPP_NAME OPP_CO OPP_AMT <<<"$row"
  if [ -n "${ONLY:-}" ] && [[ ",${ONLY}," != *",${NAME},"* ]]; then
    continue
  fi
  PAGE_URL="${SITE_URL}${PATH}"
  DOCS_URL="${SITE_URL}${DOCS}"

  info "═══ ${NAME} ═══"
  PID=$(ensure_product "$NAME" "$PAGE_URL" "$DESC")
  [ -n "$PID" ] && [ "$PID" != "null" ] || { warn "skip ${NAME} — no product id"; continue; }
  info "  product ${PID}"
  CREATED+=("${NAME}|${PID}")

  add_source "$PID" "$PAGE_URL" "${NAME} product page"
  add_source "$PID" "$DOCS_URL" "${NAME} docs"
  add_source "$PID" "${SITE_URL}/why-zyvor" "Why Zyvor"
  add_source "$PID" "${SITE_URL}/get-started" "Get Started"

  if [ "$SKIP_INGEST" != "1" ]; then
    info "  ingest…"
    api POST "/products/${PID}/ingest" -d '{"force":true,"async_mode":true}' | "$JQ_BIN" -c '.' || warn "ingest failed"
    wait_ingest "$PID"
  fi

  info "  CRM opportunity…"
  create_opportunity "$PID" "$OPP_NAME" "$OPP_CO" "$OPP_AMT" || warn "opportunity failed"

  if [ "$SKIP_OUTREACH" != "1" ]; then
    local existing_campaign
    existing_campaign=$(api GET "/products/${PID}/artifacts" 2>/dev/null \
      | "$JQ_BIN" -r --arg c "${NAME} suite seed" \
        '[.[] | select(.type=="outreach" and ((.title // "") | contains($c)))] | length' 2>/dev/null || echo 0)
    if [ "${existing_campaign:-0}" != "0" ] && [ "${existing_campaign}" -gt 0 ] 2>/dev/null; then
      info "  outreach campaign exists — skip"
    else
      info "  customer mail + follow-up sequence…"
      generate_outreach "$PID" "$PROSPECT" "$PERSONA" "${NAME} suite seed" \
        || warn "outreach failed (LLM may still be warming)"
    fi
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────
info ""
info "Seeded Zyvor suite products:"
for entry in "${CREATED[@]}"; do
  n="${entry%%|*}"; id="${entry##*|}"
  info "  • ${n}  →  ${API_BASE%/api/v1}/products/${id}"
  info "      pipeline: ${API_BASE%/api/v1}/products/${id}/pipeline"
done
info ""
info "Open UI: ${API_BASE%/api/v1}/dashboard"
info "Outreach drafts need Approve before publish (SMTP). Review Artifacts in each product."
