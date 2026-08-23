#!/usr/bin/env bash
# Deploy Aurora (api/web/workers) into the K3s cluster already running on the
# remote host, alongside (not replacing) the docker-compose deployment that
# deploy-remote.sh manages. Builds images via the existing docker-compose
# build (api/workers are reused as-is; web is rebuilt separately because
# NEXT_PUBLIC_API_URL is baked into the Next.js bundle at build time and must
# point at the aurora-api NodePort, not whatever docker-compose used), then
# imports them into k3s's containerd (no registry required) and applies k8s/.
#
# Backing services (postgres/redis/qdrant/neo4j/minio/ollama) are NOT
# deployed into the cluster -- they keep running via docker-compose on the
# same host (see infra/docker-compose.yml), and the k8s Deployments in k8s/
# reach them over the host's own address instead of docker-compose's
# internal service-name DNS (which pods can't resolve). Keep the env
# overrides in k8s/deployment-api.yaml and k8s/deployment-workers.yaml in
# sync with docker-compose.prod.yml's api service if credentials/ports
# there ever change.
#
# HTTPS is served by k8s/tls-proxy-deployment.yaml -- an in-cluster nginx
# terminating TLS with a self-signed cert (CN/SAN = HOST) and reverse-
# proxying /api/* + /health to aurora-api, everything else to aurora-web, so
# the web client's own API calls stay same-origin (no mixed-content
# blocking). No CA issues trusted certs for a bare IP, so this is self-
# signed until there's a real domain -- browsers will show a trust warning.
#
# Usage:
#   ./scripts/deploy-k8s.sh HOST USER
#
# Environment:
#   COMPOSE_DIR      Remote docker-compose deploy dir to build images from
#                     (default: .deployments/emissary, matching deploy-remote.sh)
#   WEB_NODEPORT      Plain-HTTP NodePort for aurora-web (default: 30900)
#   API_NODEPORT      Plain-HTTP NodePort for aurora-api (default: 30901)
#   TLS_NODEPORT      HTTPS NodePort for the TLS proxy (default: 30443)

set -euo pipefail

HOST="${1:?usage: $0 HOST USER}"
DEPLOY_USER="${2:?usage: $0 HOST USER}"
COMPOSE_DIR="${COMPOSE_DIR:-.deployments/emissary}"
WEB_NODEPORT="${WEB_NODEPORT:-30900}"
API_NODEPORT="${API_NODEPORT:-30901}"
TLS_NODEPORT="${TLS_NODEPORT:-30443}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

info() { echo "[deploy-k8s] $*"; }

info "Rebuilding aurora-web with NEXT_PUBLIC_API_URL for the HTTPS entrypoint (NodePort ${TLS_NODEPORT})..."
ssh "${DEPLOY_USER}@${HOST}" "cd \"\$HOME/${COMPOSE_DIR}\" && sudo docker build -t aurora-web:k8s-tls \
    --build-arg NEXT_PUBLIC_API_URL=https://${HOST}:${TLS_NODEPORT}/api/v1 \
    -f apps/web/Dockerfile apps/web"

info "Importing images into k3s containerd..."
ssh "${DEPLOY_USER}@${HOST}" "
    set -e
    cd \"\$HOME/${COMPOSE_DIR}\"
    sudo docker save aurora-web:k8s-tls -o /tmp/aurora-web.tar
    sudo docker save emissary-api:latest -o /tmp/aurora-api.tar
    sudo docker save emissary-workers:latest -o /tmp/aurora-workers.tar
    sudo k3s ctr images import /tmp/aurora-web.tar
    sudo k3s ctr images import /tmp/aurora-api.tar
    sudo k3s ctr images import /tmp/aurora-workers.tar
    sudo rm -f /tmp/aurora-web.tar /tmp/aurora-api.tar /tmp/aurora-workers.tar
"

info "Syncing manifests..."
ssh "${DEPLOY_USER}@${HOST}" "mkdir -p /tmp/aurora-k8s"
scp "${SCRIPT_DIR}"/k8s/*.yaml "${DEPLOY_USER}@${HOST}:/tmp/aurora-k8s/"

info "Applying namespace + secret (from the docker-compose deploy's own .env, never read locally) + manifests..."
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

    sudo k3s kubectl apply -f /tmp/aurora-k8s/deployment-api.yaml \
        -f /tmp/aurora-k8s/deployment-workers.yaml \
        -f /tmp/aurora-k8s/deployment-web.yaml \
        -f /tmp/aurora-k8s/service.yaml \
        -f /tmp/aurora-k8s/tls-proxy-configmap.yaml \
        -f /tmp/aurora-k8s/tls-proxy-deployment.yaml
    sudo k3s kubectl rollout restart deployment/aurora-api deployment/aurora-workers deployment/aurora-web deployment/aurora-tls-proxy -n aurora
    sudo k3s kubectl rollout status deployment/aurora-api -n aurora --timeout=120s
    sudo k3s kubectl rollout status deployment/aurora-web -n aurora --timeout=120s
    sudo k3s kubectl rollout status deployment/aurora-workers -n aurora --timeout=120s
    sudo k3s kubectl rollout status deployment/aurora-tls-proxy -n aurora --timeout=90s
"

info "Deployed."
echo
echo "  HTTPS: https://${HOST}:${TLS_NODEPORT}  (self-signed -- browsers will warn until there's a real domain)"
echo "  Web:   http://${HOST}:${WEB_NODEPORT}"
echo "  API:   http://${HOST}:${API_NODEPORT}  (health: http://${HOST}:${API_NODEPORT}/health)"
echo
echo "  Logs:   ssh ${DEPLOY_USER}@${HOST} 'sudo k3s kubectl logs -n aurora deployment/aurora-api -f'"
echo "  Status: ssh ${DEPLOY_USER}@${HOST} 'sudo k3s kubectl get pods -n aurora'"
