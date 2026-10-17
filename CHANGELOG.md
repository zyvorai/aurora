# Changelog

All notable changes to Aurora are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Docker image version**: API image takes `APP_VERSION`/`GIT_SHA` build args (OCI labels, `AURORA_VERSION`/`AURORA_BUILD` env); `/health` and the OpenAPI doc report them; `scripts/deploy-remote.sh` derives them from `git describe` and prints docker, compose and Aurora versions after a deploy.

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
