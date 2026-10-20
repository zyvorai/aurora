# Changelog

All notable changes to Aurora are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Citation gate now checks claims, not just retrieval scores: a response is `grounded` only if it cites real sources (chunk id, verbatim quote, or the `[Source N]` form the prompt asks for) and every factual sentence is backed by a retrieved passage. Unsupported and conflicting claims are listed in `blocked_claims` / `GroundingResult.claims`. The old fallback that attached the top-3 retrieved chunks to uncited answers is removed.

### Fixed

- `ruff check` is now clean and blocks CI (it was `continue-on-error` with ~870 findings). Autofixes applied across `apps/api`; stylistic rules with a large footprint are ignored in `[tool.ruff.lint]`. This also fixed a real bug: `solution_architect.py` used `json` without importing it, so parsing the agent's LLM reply raised `NameError`.
- PoC installer retries `docker compose up` up to three times (image pulls are the usual first-run failure on slow or flaky networks) instead of warning once and waiting for a health check that cannot pass.
- Pages workflow no longer runs on `release: published`: the `github-pages` environment only deploys from the default branch, so the tag-ref run failed after every release. Re-run it manually (`workflow_dispatch`) or push to `main` to refresh the footer version.


## 0.2.0 — 2026-10-17

First release with an easy-test path: one-line installers (macOS, Linux, Windows), a Kubernetes PoC chart, prebuilt multi-arch images on GHCR, a Pages site with docs and a feedback form, SEO scoring, and a notarized native Mac app.

### Fixed

- API test suite is green again (312 passed): the SSO callback tests asserted old 501/409/200 responses although the callback now redirects the browser to `/login/callback?error=…|code=…` (the 404 test only passed by following that redirect to a missing path); the executive-brief test mocked 5 of its 9 count queries; the two `create_opportunity` tests did not mock the idempotency lookup that the service now performs first.


### Changed

- README: a prominent "Try it in 5 minutes" section near the top (per-OS install commands, a five-minute test checklist, feedback); installers fall back to raw.githubusercontent.com when the Pages site is not live yet.

### Added

- **Kubernetes PoC**: `charts/aurora` gains `poc.enabled` (bundled Postgres + Qdrant StatefulSets, generated and persisted credentials, minimal profile, no workers), `values-poc.yaml`, GHCR images defaulting to the chart appVersion, `helm test` health hook, an API startup probe, `llm.*` values, and `scripts/poc/install-k8s.sh` (creates a kind/k3d cluster if none, installs, port-forwards). Web gets `API_INTERNAL_URL` from the chart. Chart version 0.2.0; header/description no longer say AGPL. Verified on a fresh k3s cluster: install, all pods ready, `helm test` passed, login through the web service.

### Added

- **Aurora for Mac** (`native/`): a sandboxed SwiftUI client (macOS 14+) for any Aurora server: Keychain sign-in, products, workspace runs, SEO (audit, keywords with estimates labelled, content score), content approve/reject/publish, agents, audit log, feedback command. `AuroraKit` Swift package (API client, models, Keychain) with 7 tests; app renders tested off-screen. `scripts/package-mac.sh` builds, Developer-ID-signs, notarizes (`notarytool`), staples and checksums the DMG; `.github/workflows/release-mac.yml` does the same on a `v*` tag from secrets and attaches it to the release. A locally built 0.2.0 DMG was accepted by Apple's notary service and passes `spctl`.

### Added

- **GitHub Pages site** (`site/`, `scripts/build-site.py`, `scripts/site-check.mjs`, `.github/workflows/pages.yml`): landing page, per-OS "Try it" tabs (macOS, Linux, Windows, Kubernetes, Docker-only, Mac app), searchable docs rendered from `docs/`, feedback page, and the published installers + PoC compose file at `https://zyvorai.github.io/aurora/`. Needs Settings > Pages > Source: GitHub Actions once.

### Added

- **Easy-test PoC**: `docker-compose.poc.yml` (Postgres, Qdrant, API, web; prebuilt multi-arch images), `scripts/poc/install.sh` and `install.ps1` one-line installers with an `aurora-poc` helper (`status|logs|down|up|update|llm|reset|feedback|uninstall`), `docs/poc.md`, and GitHub issue templates for PoC feedback and bugs. Verified on Linux (amd64 guest); the Windows script is untested on real Windows.

### Added

- **Portable web image**: the browser calls a relative `/api/v1`, and `src/middleware.ts` proxies it to `API_INTERNAL_URL` read at runtime (default `http://api:8000` in the image), so a prebuilt image works on any host name or in Kubernetes. Rewrite proxy timeout raised to 30 min for long agent calls. `NEXT_PUBLIC_API_URL` still overrides for split-origin deployments.
- `.github/workflows/release-images.yml`: on a `v*` tag, multi-arch (amd64 + arm64) `aurora-api`, `aurora-workers`, `aurora-web` images to GHCR, keyless cosign-signed, with a PoC-stack smoke test once `docker-compose.poc.yml` exists.
- `.gitattributes`: LF endings for shell/Python so Windows checkouts do not break `docker-entrypoint.sh`.

### Fixed

- `infra/docker-compose.yml`: every backing service has `restart: unless-stopped`, so the stack comes back after a host/VM restart (only api/web/workers did before).

### Changed

- Zyvor brand: favicon is now Netra's orange Z tile (`app/icon.svg`, replacing the generated blue "A"), and the product console rail starts with the Z tile linking to the dashboard. `public/zyvor-mark.svg` and `zyvor-logomark.svg` come from Netra.

### Fixed

- Web image now copies `public/` (Next standalone output omits it), so `/screenshots/*` and the social card are served instead of 404.
- `infra/docker-compose.yml`: MinIO image from Chainguard (community MinIO images are gone from Docker Hub/Quay); host ports configurable (`*_HOST_PORT`); `API_BIND`/`WEB_BIND` for the prod compose.

### Changed

- Home page: framed product screenshot in the hero, trust pills, and a six-card capability grid (incl. SEO and human-approved publishing).

### Added



### Changed

- **UX contract, phase 3** (`apps/web`): agents/audit pages and the product layout show an inline `ErrorState` with retry instead of a toast-only failure or silent redirect; run log opens as a drawer below `xl`; chat widget fits phones and is a labelled dialog; one shared `lib/product-tabs.ts` feeds the workspace tabs and the rail; no duplicate error toast on workflow failures.
- **UX contract, phase 2** (`apps/web`): all hard-coded colours in component CSS replaced by tokens (`color-mix` for tints), global `:focus-visible` outline for links/buttons, nav type on the scale, `scripts/check-tokens.sh` guard, `docs/design/APPLE-UX-CONTRACT.md`.
- **UX contract, phase 1** (`apps/web`): Netra-style type scale tokens (`--fs-*`), `--hit-min`, `--hairline`, `--scrim`;
  `Button` md is now 44px and `danger` is solid; `Modal` has a unique title id, focus trap and focus return; toasts use
  `role="status"` except errors; clickable table rows are keyboard-operable; `StageChain` has `aria-current` and a focus ring.
- New primitives in `components/ui`: `Tabs`, `Select`, `Switch`, `Toolbar`/`SearchField`, `StatBand`, `ErrorState`,
  `IconButton`, `Spinner`, `Callout`, `Drawer`.
- Replaced the AGPL-3.0 + Aurora Commercial License dual license with the Zyvor Production License v1.0. Non-production use is free. Production use requires a separate paid commercial license (https://zyvor.dev).

## 2026-09-14

### Changed

- **Design system consolidation** (`apps/web`): deleted the unused "Cosmic
  Orange / iPhone 17" token block that never matched the shipped Apple-blue
  primary; unified the two disagreeing container widths (and fixed the
  app/portal nav bar not matching its own content edge); consolidated the
  card, badge, stat-tile, and heading systems onto shared tokens/primitives
  (`Card`, `Badge`, `StatGrid`, `Container`); deleted ~140 lines of dead
  "Tahoe" glass-morphism CSS.
- **Dark mode is now a real, explicit opt-in** instead of silently following
  `prefers-color-scheme` — the toggle only appears in the app shell (it used
  to render on marketing/portal pages too, where it had no visible effect).
  Dark theme's flat/cheap elevation was also fixed with real shadows.
- **Marketing pages** (`/`, `/features`): replaced every fake CSS-mockup
  "product screenshot" with real `docs/ux/` screenshots via `next/image`;
  extracted the pipeline-steps and dark CTA sections that were copy-pasted
  between both pages into shared components; added staggered scroll-reveal
  motion.
- **Accessibility**: fixed a real hydration mismatch on `/login` (an SSO
  link's `href` differed between server and client render), added
  `aria-label`s to previously-unlabeled icon-only buttons, applied the
  app's `.focus-ring` utility to every raw nav button (none had a visible
  focus state before), and fixed a light-mode text color that failed WCAG
  AA contrast at the sizes it's actually used at.
- Added `error.tsx`/`global-error.tsx` (didn't exist at all) — an unhandled
  render crash now shows an Apple-styled recovery screen instead of
  Next.js's default error page.
- Routed background-action feedback on the Sales page through the app's
  toast system instead of a message string that couldn't distinguish
  success from failure; added a loading skeleton so the leads table
  doesn't flash "No leads yet" before the real fetch resolves.
- Replaced a component's locally-reinvented `Badge`/table markup with the
  shared primitives, and aligned the command palette's overlay
  z-index/backdrop/panel surface with the shared `Modal`'s (the two had
  drifted and visibly disagreed in dark mode).
- **`apps/sales-crm`**: aligned its design system to Aurora's Apple-blue
  brand — primary color and typography now match `apps/web` exactly, so a
  user visiting the standalone Sales CRM doesn't land on a visually
  unrelated product. Its own "hot lead" orange accent and distinctive
  editorial login page are unchanged — only the brand color/font moved.

## 2026-09-13

### Changed

- Open-sourced Aurora under **AGPL-3.0**, with a commercial
  [Aurora Commercial License (ACL)](COMMERCIAL_LICENSE.md) available for
  organizations that need freedom from AGPL obligations. See
  [`docs/LICENSING.md`](docs/LICENSING.md).
- Removed the trial gate — the self-hosted app is fully usable under AGPL
  without a license check.
- Added `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, `QUICKSTART.md`, a
  `docs/README.md` index, and a minimal CI workflow.
