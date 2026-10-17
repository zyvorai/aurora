# Aurora UX contract

Aurora follows the same apple.com-style contract as Netra (`netra/docs/design/APPLE-UX-CONTRACT.md`): quiet, graphite
surfaces; blue only for intent; colour only for deviation. Tokens live in `apps/web/src/app/globals.css`
(`:root` = light, `html.dark-theme` = dark).

## Rules
1. **Tokens only.** No hex/rgb in `*.module.css` or `*.tsx`. `scripts/check-tokens.sh` enforces it (exempt: `globals.css`,
   `icon.tsx`, `ZyvorMark.tsx`, and a line marked `token-exempt`). Translucent tints use
   `color-mix(in srgb, var(--token) N%, transparent)`.
2. **Type scale.** `--fs-h1/h2/h3/figure/lede/body/link/small/micro`. Do not add raw px above 17px, except Story
   heroes (marketing, login, portal) that keep a documented display clamp.
3. **Hit targets.** Interactive controls are `--hit-min` (44px): `Button` md/lg, `IconButton`, `Select`, `SearchField`.
   `Button` sm is for dense toolbars only.
4. **Focus is always visible.** `.focus-ring` for Tailwind components; a base `:focus-visible` outline covers CSS-module
   links and buttons.
5. **One primary action per view.** Everything else is `secondary` or `ghost`.
6. **Every list has three states:** loading (`Skeleton*`), empty (`EmptyState` with a next action), error
   (`ErrorState` with retry). A toast alone is not an error state.
7. **Colour is deviation.** `StatBand`/`Callout` tones only when a value really deviates or is confirmed good.
8. Check light and dark at 1440px and 390px; no horizontal page scroll at 390px.

## Primitives (`components/ui`)
`Button`, `IconButton`, `Input`, `Select`, `Switch`, `Tabs`, `Toolbar`/`SearchField`, `Table`, `StatBand`, `Card`,
`Badge`, `Modal`, `Drawer`, `EmptyState`, `ErrorState`, `Callout`, `Spinner`, `Skeleton*`.
