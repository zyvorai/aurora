# Contributing to Aurora

1. **Open an issue or discussion first** for anything beyond a small fix —
   Aurora is under the Zyvor Production License, so larger changes are
   easier to land with agreement on approach up front.
2. **Dev setup:** [`docs/dev-guide.md`](docs/dev-guide.md) — `make start`
   gets infra + API + web running from source.
3. **Before opening a PR**, run the same checks CI runs:

   ```bash
   cd apps/web && npm ci && npm run build

   make install-api   # once
   make test          # apps/api pytest suite
   cd apps/api && .venv/bin/ruff check .
   ```

   (`npm run lint` isn't wired up yet — no ESLint config in `apps/web` — so
   it's not part of the check list until that's set up.)

4. **Update [`CHANGELOG.md`](CHANGELOG.md)** under `Unreleased` for any
   user-visible change.
5. **Licensing:** contributions are accepted under the Zyvor Production
   License (see [`LICENSE`](LICENSE)), with a grant that lets Zyvor offer
   commercial licenses. Don't submit code you don't have the right to license
   that way. See [`docs/LICENSING.md`](docs/LICENSING.md).

Questions: [sales@zyvor.dev](mailto:sales@zyvor.dev) or open a GitHub issue.
