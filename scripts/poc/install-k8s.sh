#!/usr/bin/env bash
# Aurora PoC on Kubernetes (kind or k3d locally, or any existing cluster).
#
#   curl -fsSL https://zyvorai.github.io/aurora/install-k8s.sh | bash
#   AURORA_CHART=./charts/aurora ./scripts/poc/install-k8s.sh        # from a checkout
#
# Environment: AURORA_NAMESPACE (default aurora), AURORA_RELEASE (aurora), AURORA_CHART (OCI chart or path),
# AURORA_VERSION (chart/image version), AURORA_LLM=openai|ollama|skip + OPENAI_API_KEY, AURORA_CLUSTER (kind/k3d name),
# AURORA_NO_FORWARD=1 (do not port-forward), AURORA_HELM_ARGS (extra args for helm).
set -euo pipefail
NS="${AURORA_NAMESPACE:-aurora}"; REL="${AURORA_RELEASE:-aurora}"; CLUSTER="${AURORA_CLUSTER:-aurora-poc}"
CHART="${AURORA_CHART:-oci://ghcr.io/zyvorai/charts/aurora}"
say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required. $2"; }

need kubectl "Install: https://kubernetes.io/docs/tasks/tools/ (brew install kubectl)"
need helm "Install: https://helm.sh/docs/intro/install/ (brew install helm)"

if ! kubectl cluster-info >/dev/null 2>&1; then
  say "No reachable cluster; creating a local one"
  need docker "A local cluster needs Docker (Docker Desktop / Engine) running."
  if command -v kind >/dev/null 2>&1; then kind create cluster --name "$CLUSTER"
  elif command -v k3d >/dev/null 2>&1; then k3d cluster create "$CLUSTER"
  else die "No cluster and neither kind nor k3d found. Install one (brew install kind) or point kubectl at a cluster."; fi
fi
say "Using cluster: $(kubectl config current-context)"

args=(--namespace "$NS" --create-namespace --wait --timeout 10m --set poc.enabled=true --set workers.enabled=false)
[ -d "$CHART" ] && [ -f "$CHART/values-poc.yaml" ] && args+=(-f "$CHART/values-poc.yaml")
[ -n "${AURORA_VERSION:-}" ] && args+=(--version "$AURORA_VERSION" --set "api.image.tag=$AURORA_VERSION" --set "web.image.tag=$AURORA_VERSION")
case "${AURORA_LLM:-skip}" in
  openai) [ -n "${OPENAI_API_KEY:-}" ] || die "set OPENAI_API_KEY"
          args+=(--set llm.provider=openai --set "llm.openaiApiKey=$OPENAI_API_KEY"); [ -n "${OPENAI_BASE_URL:-}" ] && args+=(--set "llm.openaiBaseUrl=$OPENAI_BASE_URL") ;;
  ollama) args+=(--set llm.provider=ollama --set "llm.ollamaBaseUrl=${OLLAMA_BASE_URL:-http://host.docker.internal:11434/v1}") ;;
esac
# shellcheck disable=SC2086
say "Installing Aurora ($CHART)"
helm upgrade --install "$REL" "$CHART" "${args[@]}" ${AURORA_HELM_ARGS:-}

say "Running health test"
helm test "$REL" --namespace "$NS" >/dev/null && echo "health test passed" || echo "health test did not pass yet; check: kubectl -n $NS get pods"

cat <<EOF

  Aurora is installed in namespace '$NS'.
    Open:    http://localhost:3000   (after port-forward below)
    Sign in: marketing@zyvor.dev  /  Admin@321   (demo account - change it beyond a throwaway test)
    LLM:     helm upgrade $REL $CHART --namespace $NS --reuse-values --set llm.provider=openai --set llm.openaiApiKey=...
    Feedback: https://github.com/zyvorai/aurora/issues/new?template=poc-feedback.yml
    Remove:  helm uninstall $REL -n $NS && kubectl delete pvc -n $NS --all

EOF
[ -n "${AURORA_NO_FORWARD:-}" ] || { say "Port-forwarding web to localhost:3000 (Ctrl-C to stop)"; kubectl --namespace "$NS" port-forward "svc/${REL}-web" 3000:3000; }
