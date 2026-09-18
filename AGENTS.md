# Agent instructions

## What Aurora is

A multi-tenant SaaS platform that onboards a software product from a website
or docs URL, builds a knowledge graph + RAG store, and runs AI marketing,
sales, and solution agents on top of it (Next.js/React frontend, FastAPI
backend, LangChain/LangGraph agents). Licensed under the Zyvor Production License v1.0: free for non-production
use, commercial license required for production — see
[`docs/LICENSING.md`](docs/LICENSING.md).

## Hard boundaries

- Never commit real secrets, API keys, or `.env` files — only `.env*.example`
  templates belong in git.
- Don't weaken or remove Zyvor Production License notices without an explicit human request.
- Don't change the seeded demo credentials (`marketing@zyvor.dev` /
  `Admin@321`, Keycloak `demo`/`demo`) without updating every doc that
  references them (`docs/sso-oidc.md`, `docs/customer/admin-basics.md`,
  `QUICKSTART.md`, root `README.md`).
- `apps/sales-crm` is a standalone Go microservice with its own SQLite DB —
  it is deliberately **not** wired to the platform's built-in opportunities
  pipeline (`apps/api/gtm_api/routers/crm.py`). Don't couple them without an
  explicit request.

## AI / LLM surface

Single provider factory (`apps/api/gtm_api/services/llm.py`) switches between
**Ollama** (free, local, dev default) and **OpenAI-compatible** (production)
via `LLM_PROVIDER`, with per-agent model routing. See
[`docs/ollama-llm-integration.md`](docs/ollama-llm-integration.md) before
touching agent prompts, model routing, or the factory itself — there are
unit and integration tests specifically for provider parity.

## Validation before a PR

```bash
cd apps/web && npm ci && npm run build

make install-api   # once
make test          # apps/api pytest suite (223 tests, see docs/test-cases.md)
cd apps/api && .venv/bin/ruff check .
```

(`npm run lint` isn't wired up yet — no ESLint config in `apps/web`.)

Update [`CHANGELOG.md`](CHANGELOG.md) for user-visible changes.
