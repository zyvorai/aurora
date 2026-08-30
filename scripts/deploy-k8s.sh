#!/usr/bin/env bash
# Deploy Aurora (api/web/workers) into the K3s cluster already running on the
# remote host. Backing services stay on docker-compose (infra only).
# HTTPS is the in-cluster nginx tls-proxy NodePort 30443 (self-signed).
#
# Usage:
#   ./scripts/deploy-k8s.sh HOST USER
#
# Environment:
#   COMPOSE_DIR      Remote docker-compose deploy dir (default: .deployments/aurora)
#   WEB_NODEPORT / API_NODEPORT / TLS_NODEPORT  (defaults 30900 / 30901 / 30443)

set -euo pipefail

HOST="${1:?usage: $0 HOST USER}"
DEPLOY_USER="${2:?usage: $0 HOST USER}"
COMPOSE_DIR="${COMPOSE_DIR:-.deployments/aurora}"
WEB_NODEPORT="${WEB_NODEPORT:-30900}"
API_NODEPORT="${API_NODEPORT:-30901}"
TLS_NODEPORT="${TLS_NODEPORT:-30443}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

info() { echo "[deploy-k8s] $*"; }

info "Rebuilding aurora-web with NEXT_PUBLIC_API_URL for HTTPS NodePort ${TLS_NODEPORT}..."
ssh "${DEPLOY_USER}@${HOST}" "cd \"\$HOME/${COMPOSE_DIR}\" && sudo docker build -t aurora-web:k8s-tls \
    --build-arg NEXT_PUBLIC_API_URL=https://${HOST}:${TLS_NODEPORT}/api/v1 \
    -f apps/web/Dockerfile apps/web"

info "Importing images into k3s containerd..."
ssh "${DEPLOY_USER}@${HOST}" "
    set -e
    cd \"\$HOME/${COMPOSE_DIR}\"
    sudo docker save aurora-web:k8s-tls -o /tmp/aurora-web.tar
    sudo docker save aurora-api:latest -o /tmp/aurora-api.tar
    sudo docker save aurora-workers:latest -o /tmp/aurora-workers.tar
    sudo k3s ctr images import /tmp/aurora-web.tar
    sudo k3s ctr images import /tmp/aurora-api.tar
    sudo k3s ctr images import /tmp/aurora-workers.tar
    sudo rm -f /tmp/aurora-web.tar /tmp/aurora-api.tar /tmp/aurora-workers.tar
"

info "Syncing manifests..."
ssh "${DEPLOY_USER}@${HOST}" "mkdir -p /tmp/aurora-k8s"
scp "${SCRIPT_DIR}"/k8s/*.yaml "${DEPLOY_USER}@${HOST}:/tmp/aurora-k8s/"

info "Applying namespace + secret + manifests..."
ssh "${DEPLOY_USER}@${HOST}" "
    set -e
    sudo k3s kubectl apply -f /tmp/aurora-k8s/namespace.yaml
    sudo k3s kubectl create secret generic aurora-env \
        --from-env-file=\"\$HOME/${COMPOSE_DIR}/.env\" -n aurora \
        --dry-run=client -o yaml | sudo k3s kubectl apply -f -

    if ! sudo k3s kubectl get secret aurora-tls -n aurora >/dev/null 2>&1; then
        echo '[deploy-k8s] Generating self-signed TLS cert for ${HOST}...'
        d=\$(mktemp -d)
        openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
            -keyout \"\$d/tls.key\" -out \"\$d/tls.crt\" \
            -subj '/CN=${HOST}' -addext 'subjectAltName=IP:${HOST}'
        sudo k3s kubectl create secret tls aurora-tls \
            --cert=\"\$d/tls.crt\" --key=\"\$d/tls.key\" -n aurora
        shred -u \"\$d/tls.key\" 2>/dev/null || rm -f \"\$d/tls.key\"
        rm -f \"\$d/tls.crt\"; rmdir \"\$d\"
    fi

    # Drop any leftover Cilium Gateway objects (not used)
    sudo k3s kubectl -n aurora delete gateway,httproute,certificate --all --ignore-not-found 2>/dev/null || true

    sudo k3s kubectl apply -f /tmp/aurora-k8s/deployment-api.yaml \
        -f /tmp/aurora-k8s/deployment-workers.yaml \
        -f /tmp/aurora-k8s/deployment-web.yaml \
        -f /tmp/aurora-k8s/service.yaml \
        -f /tmp/aurora-k8s/tls-proxy-configmap.yaml \
        -f /tmp/aurora-k8s/tls-proxy-deployment.yaml
    sudo k3s kubectl rollout restart deployment/aurora-api deployment/aurora-workers deployment/aurora-web deployment/aurora-tls-proxy -n aurora
    sudo k3s kubectl rollout status deployment/aurora-api -n aurora --timeout=180s
    sudo k3s kubectl rollout status deployment/aurora-web -n aurora --timeout=120s
    sudo k3s kubectl rollout status deployment/aurora-workers -n aurora --timeout=120s
    sudo k3s kubectl rollout status deployment/aurora-tls-proxy -n aurora --timeout=90s
"

info "Deployed."
echo
echo "  HTTPS: https://${HOST}:${TLS_NODEPORT}  (self-signed -- browsers will warn)"
echo "  Web:   http://${HOST}:${WEB_NODEPORT}"
echo "  API:   http://${HOST}:${API_NODEPORT}  (health: http://${HOST}:${API_NODEPORT}/health)"
echo
echo "  Logs:   ssh ${DEPLOY_USER}@${HOST} 'sudo k3s kubectl logs -n aurora deployment/aurora-api -f'"
echo "  Status: ssh ${DEPLOY_USER}@${HOST} 'sudo k3s kubectl get pods -n aurora'"
