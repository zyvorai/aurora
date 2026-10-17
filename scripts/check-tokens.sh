#!/usr/bin/env bash
# Fails when component CSS / TSX hard-codes a colour. Use design tokens from globals.css instead
# (docs/design/APPLE-UX-CONTRACT.md). Brand constants and the root error page are exempt:
# add `token-exempt` in a comment on the same line, or list the file below.
set -euo pipefail
cd "$(dirname "$0")/../apps/web/src"
EXEMPT_FILES='app/globals.css|app/icon.tsx|components/ZyvorMark.tsx'
bad=$(grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(' app components --include='*.css' --include='*.tsx' \
  | grep -vE "^(${EXEMPT_FILES}):" | grep -v 'token-exempt' | grep -vE 'var\(--[a-z-]+, *#' || true)
if [ -n "$bad" ]; then
  echo "Hard-coded colours found (use tokens):" >&2
  echo "$bad" >&2
  exit 1
fi
echo "check-tokens: ok"
