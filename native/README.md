# Aurora for Mac

A native SwiftUI client for an Aurora server (the PoC at `http://localhost:3000`, or your own). macOS 14+, Apple Silicon and Intel.

- **Sign in** with your server address and account. The token lives in the Keychain, never in preferences.
- **Products**: workspace runs with live progress, SEO (page audit, keywords with estimates clearly labelled, content score),
  Content (review, approve or reject, publish), plus Agents and the Audit log.
- **Sandboxed** with only the outgoing-network entitlement. HTTPS is required except for `localhost` and local-network hosts.
- Help → *Send Feedback…* opens the pre-filled feedback form.

## Build

```bash
brew install xcodegen
cd native && xcodegen generate && open Aurora.xcodeproj      # or: xcodebuild -scheme Aurora build
swift test --package-path AuroraKit                           # API client tests
```

## Package, sign and notarize

```bash
scripts/package-mac.sh                                        # unsigned DMG in dist/
DEVELOPER_ID_APP="Developer ID Application: NAME (TEAMID)" NOTARY_PROFILE=<profile> scripts/package-mac.sh
```

Create the notary profile once with `xcrun notarytool store-credentials <profile>`. CI does the same from secrets
(`.github/workflows/release-mac.yml`: `MACOS_CERTS_P12`, `MACOS_CERTS_PASSWORD`, `DEVELOPER_ID_APP`, `NOTARY_KEY_P8`,
`NOTARY_KEY_ID`, `NOTARY_ISSUER`). Regenerate the icon with `swift scripts/make-app-icon.swift native/App/Assets.xcassets/AppIcon.appiconset`.

`AuroraKit` (Swift package) holds the API client, models and Keychain store; `App/` is the SwiftUI app; `Tests/` renders key screens
off-screen (AppKit-backed controls such as text fields show as placeholders in those renders).
