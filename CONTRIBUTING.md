# Contributing to Aurora

1. **Open an issue or discussion first** for anything beyond a small fix —
   Aurora is dual-licensed (AGPL-3.0 + commercial ACL), so larger changes are
   easier to land with agreement on approach up front.
2. **Dev setup:** [`docs/dev-guide.md`](docs/dev-guide.md) — `make start`
   gets infra + API + web running from source.
3. **Before opening a PR**, run the same checks CI runs:

   ```bash
   cd apps/web && npm ci && npm run lint && npm run build

   make install-api   # once
   make test          # apps/api pytest suite
   cd apps/api && .venv/bin/ruff check .
   ```

4. **Update [`CHANGELOG.md`](CHANGELOG.md)** under `Unreleased` for any
   user-visible change.
5. **Licensing:** contributions to this repository are accepted under
   AGPL-3.0 (see [`LICENSE`](LICENSE)). Don't submit code you don't have the
   right to license that way. See [`docs/LICENSING.md`](docs/LICENSING.md)
   for how the AGPL / commercial ACL split works.

Questions: [sales@zyvor.dev](mailto:sales@zyvor.dev) or open a GitHub issue.
