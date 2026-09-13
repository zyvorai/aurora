# Changelog

All notable changes to Aurora are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
