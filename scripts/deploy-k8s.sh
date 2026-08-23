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
# Usage:
#   ./scripts/deploy-k8s.sh HOST USER
#
# Environment:
#   COMPOSE_DIR      Remote docker-compose deploy dir to build images from
#                     (default: .deployments/emissary, matching deploy-remote.sh)
#   WEB_NODEPORT      NodePort for aurora-web (default: 30900)
#   API_NODEPORT      NodePort for aurora-api (default: 30901)

set -euo pipefail

HOST="${1:?usage: $0 HOST USER}"
DEPLOY_USER="${2:?usage: $0 HOST USER}"
COMPOSE_DIR="${COMPOSE_DIR:-.deployments/emissary}"
WEB_NODEPORT="${WEB_NODEPORT:-30900}"
API_NODEPORT="${API_NODEPORT:-30901}"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

info() { echo "[deploy-k8s] $*"; }

info "Rebuilding aurora-web with NEXT_PUBLIC_API_URL for NodePort ${API_NODEPORT}..."
ssh "${DEPLOY_USER}@${HOST}" "cd \"\$HOME/${COMPOSE_DIR}\" && sudo docker build -t aurora-web:k8s \
    --build-arg NEXT_PUBLIC_API_URL=http://${HOST}:${API_NODEPORT}/api/v1 \
    -f apps/web/Dockerfile apps/web"

info "Importing images into k3s containerd..."
ssh "${DEPLOY_USER}@${HOST}" "
    set -e
    cd \"\$HOME/${COMPOSE_DIR}\"
    sudo docker save aurora-web:k8s -o /tmp/aurora-web.tar
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
    sudo k3s kubectl apply -f /tmp/aurora-k8s/deployment-api.yaml \
        -f /tmp/aurora-k8s/deployment-workers.yaml \
        -f /tmp/aurora-k8s/deployment-web.yaml \
        -f /tmp/aurora-k8s/service.yaml
    sudo k3s kubectl rollout restart deployment/aurora-api deployment/aurora-workers deployment/aurora-web -n aurora
    sudo k3s kubectl rollout status deployment/aurora-api -n aurora --timeout=120s
    sudo k3s kubectl rollout status deployment/aurora-web -n aurora --timeout=120s
    sudo k3s kubectl rollout status deployment/aurora-workers -n aurora --timeout=120s
"

info "Deployed."
echo
echo "  Web:  http://${HOST}:${WEB_NODEPORT}"
echo "  API:  http://${HOST}:${API_NODEPORT}  (health: http://${HOST}:${API_NODEPORT}/health)"
echo
echo "  Logs:   ssh ${DEPLOY_USER}@${HOST} 'sudo k3s kubectl logs -n aurora deployment/aurora-api -f'"
echo "  Status: ssh ${DEPLOY_USER}@${HOST} 'sudo k3s kubectl get pods -n aurora'"
