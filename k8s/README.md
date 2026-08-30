# Aurora on K3s

Deploys api/web/workers into the K3s cluster on the same host as the
docker-compose **infra** (`./scripts/deploy-remote.sh` starts postgres/redis/…
only when namespace `aurora` already exists — never a second compose app layer).

```
./scripts/deploy-k8s.sh 175.110.122.71 sus
```

## Entrypoint

- **`https://<host>:30443`** — nginx `aurora-tls-proxy` (self-signed cert)
- Break-glass: web NodePort 30900, api NodePort 30901

## What's NOT in this cluster

Postgres, Redis, Qdrant, Neo4j, MinIO, and Keycloak run via
`infra/docker-compose.yml` on the host. LLM uses an OpenAI-compatible API
(lab: Groq, same key as zyvor-web) — Ollama is opt-in (`--profile ollama`).

Do **not** also run compose `api`/`web`/`workers` alongside K8s — that
double-runs alembic and breaks the DB.

## Seed Zyvor.dev suite (CRM + mail follow-ups)

```bash
API_BASE=https://<host>:30443/api/v1 CURL_OPTS=-k ./scripts/seed-zyvor-suite.sh
```

Creates products **Axiom, Aurora, Forge, Ragnarok, Haven** from zyvor.dev pages,
queues ingest, opens a discovery-stage CRM opportunity per product, and drafts
outreach + 3-step customer mail follow-up sequences (Approve before publish).

## SSO

Realm **`aurora`** (never `emissary`):

```text
https://<host>:30443/api/v1/auth/sso/callback
```

Demo Keycloak user when SSO is wired: `demo` / `demo`. Guide: [`docs/sso-oidc.md`](../docs/sso-oidc.md).
