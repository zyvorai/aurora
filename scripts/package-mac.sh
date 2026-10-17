#!/usr/bin/env bash
# Build, sign, (optionally) notarize and package "Aurora for Mac" as a DMG.
#
#   scripts/package-mac.sh                       # unsigned (ad-hoc) DMG: fine for testing, Gatekeeper will warn
#   DEVELOPER_ID_APP="Developer ID Application: NAME (TEAMID)" scripts/package-mac.sh            # signed
#   DEVELOPER_ID_APP=... NOTARY_PROFILE=<notarytool keychain profile> scripts/package-mac.sh    # signed + notarized + stapled
#
# Credentials are never read from the repo: the signing identity comes from the keychain, the notary profile from
# `xcrun notarytool store-credentials`. In CI the keychain and profile are created from secrets (see release-mac.yml).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/native"
VER="${AURORA_VERSION:-$(sed -n 's/^ *MARKETING_VERSION: *//p' project.yml | head -1)}"
ID="${DEVELOPER_ID_APP:-}"
NOTARY="${NOTARY_PROFILE:-}"
OUT="${OUT_DIR:-$ROOT/dist}"
APP="build/Build/Products/Release/Aurora.app"
DMG="$OUT/Aurora-$VER.dmg"

command -v xcodegen >/dev/null || { echo "xcodegen is required: brew install xcodegen" >&2; exit 1; }
xcodegen generate >/dev/null
rm -rf build
xcodebuild -project Aurora.xcodeproj -scheme Aurora -configuration Release -derivedDataPath build \
  MARKETING_VERSION="$VER" CODE_SIGNING_ALLOWED=NO build | tail -3
[ -d "$APP" ] || { echo "build did not produce $APP" >&2; exit 1; }

if [ -n "$ID" ]; then
  echo "==> signing with: $ID"
  codesign --force --options runtime --timestamp --entitlements Config/Aurora.entitlements --sign "$ID" "$APP"
  codesign --verify --deep --strict --verbose=2 "$APP"
else
  echo "==> no DEVELOPER_ID_APP: ad-hoc signing (Gatekeeper will warn)"
  codesign --force --entitlements Config/Aurora.entitlements --sign - "$APP"
fi

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/dmg" "$OUT"
cp -R "$APP" "$WORK/dmg/"
ln -s /Applications "$WORK/dmg/Applications"
rm -f "$DMG"
hdiutil create -volname "Aurora $VER" -srcfolder "$WORK/dmg" -fs HFS+ -format UDZO -ov "$DMG" >/dev/null
[ -n "$ID" ] && codesign --force --timestamp --sign "$ID" "$DMG"

status="unsigned (ad-hoc)"
if [ -n "$ID" ]; then
  status="Developer ID signed, NOT notarized (set NOTARY_PROFILE)"
  if [ -n "$NOTARY" ]; then
    xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY" --wait
    xcrun stapler staple "$DMG"
    xcrun stapler validate "$DMG"
    spctl -a -t open --context context:primary-signature -vv "$DMG"
    status="Developer ID signed, notarized and stapled"
  fi
fi
(cd "$OUT" && shasum -a 256 "$(basename "$DMG")" > "$(basename "$DMG").sha256")
echo "==> $DMG  [$status]"
cat "$DMG.sha256"
