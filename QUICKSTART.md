# Quickstart

Three ways to run Aurora, from fastest to production-shaped. Full detail:
[`docs/dev-guide.md`](docs/dev-guide.md) (local dev) and
[`k8s/README.md`](k8s/README.md) (K3s / production).

## Path 1 — Source, one command (recommended for trying it out)

**Requires Docker Desktop running.**

```bash
make start    # infra + Postgres/Neo4j/Qdrant/Redis/MinIO + API + web (background)
# → http://localhost:3000  (web)
# → http://localhost:8000  (api)
make stop     # when done
```

Local LLM is free but needs models pulled first (`make ollama-pull`, or
`brew install ollama && ollama serve`); or set `LLM_PROVIDER=openai` +
`OPENAI_API_KEY` in `.env` to skip that. See
[`docs/ollama-llm-integration.md`](docs/ollama-llm-integration.md).

## Path 2 — Containerized / production compose

```bash
cp .env.prod.example .env   # edit secrets first
docker compose --project-directory . -f infra/docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Path 3 — Remote K3s deploy

```bash
./scripts/deploy-remote.sh <host> <user>          # infra
./scripts/deploy-k8s.sh <host> <user>             # api/web/workers + TLS :30443
./scripts/seed-zyvor-suite.sh                     # seed demo products + CRM
```

See [`k8s/README.md`](k8s/README.md) for the TLS entrypoint and sync steps.

## Sign in

| Path | Username / email | Password | Notes |
|------|------------------|----------|-------|
| Email/password (always available) | `marketing@zyvor.dev` | `Admin@321` | Seeded on first boot (`SEED_DEFAULT_ADMIN=true` default). **Change immediately** outside a throwaway lab. |
| Keycloak SSO (bundled demo IdP) | `demo` | `demo` | Smoke-test only. See [`docs/sso-oidc.md`](docs/sso-oidc.md). |

Sign-in is two-step: email → **Continue** → password (or **Continue with
SSO** when `SSO_ENABLED=true`).

## Where to go first

| Page | Route | What it's for |
|------|-------|----------------|
| GTM workspace | `/dashboard` | Create/onboard a product; land on your role-default persona view. |
| Full Forge | `/products/:id` | Ingest sources, run GTM chain stages, approve and publish. |
| Executive Brief | `/products/:id/brief` | KPIs and GTM readiness — loads without an LLM call. |
| Sales Action | `/products/:id/sales` | Discover/qualify leads and outreach. |
| Admin | `/dashboard/admin/*` | Portal accounts, sales activity, workflow stages, danger zone. |

Full route index: [`docs/customer/PAGE_INDEX.md`](docs/customer/PAGE_INDEX.md).

**First useful thing after login:** add a product URL → ingest a source →
**Build profile** → run strategy or Q&A.

## Smoke test

```bash
curl -s http://127.0.0.1:8000/health          # compose
curl -sk https://127.0.0.1:30443/health       # K3s
```

## Related

- [`docs/dev-guide.md`](docs/dev-guide.md) — full local dev setup, Makefile
  reference, troubleshooting
- [`docs/customer/getting-started.md`](docs/customer/getting-started.md) —
  customer-facing walkthrough
- [`docs/customer/admin-basics.md`](docs/customer/admin-basics.md) — ports,
  auth, ops quick reference
