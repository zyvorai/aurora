#!/usr/bin/env bash
# Builds a self-contained, offline-installable Aurora trial package:
# docker-save images + Helm chart + compose + k8s manifests + INSTALL guides.
# No source code is included.
#
# Usage: scripts/build-customer-package.sh [version]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

VERSION="${1:-$(grep '^appVersion:' charts/aurora/Chart.yaml | sed 's/appVersion: *"\?//;s/"$//' | tr -d ' ')}"
if [ -z "${VERSION}" ]; then
  echo "error: pass a version: $0 <version>" >&2
  exit 1
fi

BUILD_DIR="$(mktemp -d)"
PKG_NAME="aurora-${VERSION}"
PKG_DIR="${BUILD_DIR}/${PKG_NAME}"
DIST_DIR="${REPO_ROOT}/dist"
trap 'rm -rf "${BUILD_DIR}"' EXIT

echo "==> Building customer package ${PKG_NAME}"
mkdir -p "${PKG_DIR}/images" "${PKG_DIR}/charts" "${PKG_DIR}/k8s" "${DIST_DIR}"

# Web image must embed a public API URL. Trial packages default to relative
# same-origin /api/v1 via a reverse proxy; for compose eval we bake localhost.
WEB_API_URL="${WEB_API_URL:-http://localhost:8000/api/v1}"

echo "==> Building images"
docker build -t "aurora-api:${VERSION}" -t aurora-api:latest -f apps/api/Dockerfile apps/api
docker build -t "aurora-workers:${VERSION}" -t aurora-workers:latest -f apps/workers/Dockerfile .
docker build -t "aurora-web:${VERSION}" -t aurora-web:latest \
  --build-arg "NEXT_PUBLIC_API_URL=${WEB_API_URL}" \
  -f apps/web/Dockerfile apps/web

echo "==> Saving image tarballs"
docker save "aurora-api:${VERSION}" -o "${PKG_DIR}/images/aurora-api-${VERSION}.tar"
docker save "aurora-workers:${VERSION}" -o "${PKG_DIR}/images/aurora-workers-${VERSION}.tar"
docker save "aurora-web:${VERSION}" -o "${PKG_DIR}/images/aurora-web-${VERSION}.tar"

echo "==> Packaging Helm chart (tags pinned to ${VERSION})"
CHART_BUILD="${BUILD_DIR}/chart"
cp -R charts/aurora "${CHART_BUILD}"
perl -i -pe "s/(tag:\\s*)\"[^\"]+\"/\${1}\"${VERSION}\"/g" "${CHART_BUILD}/values.yaml"
cat > "${CHART_BUILD}/Chart.yaml" <<EOF
apiVersion: v2
name: aurora
description: Aurora — AI-powered GTM orchestration (30-day trial, then license key)
type: application
version: ${VERSION}
appVersion: "${VERSION}"
keywords:
  - aurora
  - gtm
  - ai
maintainers:
  - name: Zyvor AI Labs
    email: sales@zyvor.dev
home: https://github.com/hypersdk/aurora
EOF
helm package "${CHART_BUILD}" --app-version "${VERSION}" --destination "${PKG_DIR}/charts"

echo "==> Copying compose, k8s, license, guides"
cp packaging/docker-compose.trial.yml "${PKG_DIR}/"
cp packaging/env.trial.example "${PKG_DIR}/.env.trial.example"
cp -R k8s/*.yaml "${PKG_DIR}/k8s/" 2>/dev/null || true
cp LICENSE "${PKG_DIR}/" 2>/dev/null || echo "Proprietary — Zyvor AI Labs. Contact sales@zyvor.dev" > "${PKG_DIR}/LICENSE"
sed "s/__VERSION__/${VERSION}/g" packaging/INSTALL.md.tmpl > "${PKG_DIR}/INSTALL.md"
sed "s/__VERSION__/${VERSION}/g" packaging/AFTER-TRIAL.md.tmpl > "${PKG_DIR}/AFTER-TRIAL.md"

echo "==> Archiving"
OUT_TAR="${DIST_DIR}/${PKG_NAME}.tar.gz"
tar -C "${BUILD_DIR}" -czf "${OUT_TAR}" "${PKG_NAME}"
CHECKSUM="$(shasum -a 256 "${OUT_TAR}" | cut -d' ' -f1)"
echo "${CHECKSUM}  $(basename "${OUT_TAR}")" > "${OUT_TAR}.sha256"

echo ""
echo "==> Done"
echo "    Package: ${OUT_TAR}"
echo "    Size:    $(du -h "${OUT_TAR}" | cut -f1)"
echo "    SHA256:  ${CHECKSUM}"
echo "    Next:    scripts/publish-trial-release.sh ${VERSION}"
