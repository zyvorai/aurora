#!/usr/bin/env bash
# Publishes dist/aurora-<version>.tar.gz as a PUBLIC GitHub Release on the
# binary-only distribution repo (no source). Default: hypersdk/aurora
#
# Usage: scripts/publish-trial-release.sh <version> [repo]
set -euo pipefail

VERSION="${1:?usage: $0 <version> [repo]}"
REPO="${2:-hypersdk/aurora}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="${REPO_ROOT}/dist/aurora-${VERSION}.tar.gz"
CHECKSUM_FILE="${PKG}.sha256"
TAG="v${VERSION}"

if [ ! -f "${PKG}" ] || [ ! -f "${CHECKSUM_FILE}" ]; then
  echo "error: ${PKG} (or .sha256) not found — run scripts/build-customer-package.sh ${VERSION} first" >&2
  exit 1
fi

if ! tar -tzf "${PKG}" | grep -q 'trial\.token$'; then
  echo "error: ${PKG} is missing trial.token — re-run build-customer-package.sh" >&2
  exit 1
fi

NOTES="$(cat <<EOF
Self-contained **evaluation** package for Aurora (AI GTM orchestration).

- Container images (\`docker\`/\`podman\` load), Helm chart, compose file, and install guides
- **No source code** in this repository or release
- Ships a signed \`trial.token\` (Ed25519 JWT) — expiry is inside the token
- Compose mounts \`./trial.token\` at \`/app/trial.token\`; Helm: \`--set license.key=<jwt>\`
- Email **sales@zyvor.dev** for a renewed token after expiry

See \`GETTING-STARTED.md\`, \`INSTALL.md\`, \`LICENSING.md\`, and \`AFTER-TRIAL.md\` inside the archive.

SHA256: \`$(cut -d' ' -f1 "${CHECKSUM_FILE}")\`
EOF
)"

echo "==> Publishing PUBLIC release:"
echo "    Repo:  ${REPO}"
echo "    Tag:   ${TAG}"
echo "    Asset: $(basename "${PKG}") ($(du -h "${PKG}" | cut -f1))"

gh release create "${TAG}" \
  --repo "${REPO}" \
  --title "Aurora ${VERSION} — evaluation (signed trial.token)" \
  --notes "${NOTES}" \
  "${PKG}" "${CHECKSUM_FILE}"

echo "==> Published: https://github.com/${REPO}/releases/tag/${TAG}"
