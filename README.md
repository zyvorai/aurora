# Aurora

Turn your technical product into an AI-powered salesperson.

Multi-tenant SaaS platform where software companies onboard by providing a website or documentation. The platform automatically discovers the product, builds a searchable knowledge graph + RAG store, then runs AI marketing, sales, and solution agents.

## Architecture

```
Customer Sources → Product Discovery → Knowledge Extraction → AI Knowledge Graph
                                                                    ↓
                    Marketing AI ← Supervisor → Sales AI → Solution AI
                                    ↓
                    Omnichannel Publishing → Analytics → Continuous Learning
```

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, Tailwind CSS, shadcn/ui |
| Backend | FastAPI (Python) |
| Agents | LangChain, LangGraph |
| LLM (dev) | Ollama (Llama, Qwen, DeepSeek, Gemma) |
| LLM (prod) | OpenAI (GPT-4o / GPT-4o-mini) |
| Vector DB | Qdrant |
| Knowledge Graph | Neo4j |
| Relational DB | PostgreSQL |
| Cache/Queue | Redis |
| Object Storage | MinIO |

## Quick Start

**Requires Docker Desktop running.**

```bash
make start    # infra + DB + API + web (background)
# → http://localhost:3000  (web)
# → http://localhost:8000  (api)
make stop     # when done
```

First time or manual setup: see **[docs/dev-guide.md](docs/dev-guide.md)** (full install, Makefile reference, start/stop scripts, troubleshooting).

```bash
# Optional: Ollama (free local LLM, default provider)
brew install ollama && ollama serve && make ollama-pull

# Or OpenAI: set LLM_PROVIDER=openai and OPENAI_API_KEY in .env
```

### Containerized / production

```bash
cp .env.prod.example .env   # then edit secrets
docker compose --project-directory . -f infra/docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Deploy to a remote Docker host over SSH (syncs the repo, installs the Compose plugin if
missing, brings the stack up, polls `/health`):

```bash
./scripts/deploy-remote.sh <host> <user>
./scripts/test-deploy-remote-e2e.sh <host> <user> --skip-deploy   # smoke test only
```

### Sales CRM (`apps/sales-crm`)

A standalone Go lead/deal-pipeline CRM microservice (Kanban pipeline, SLA timers,
round-robin owners, `POST /api/leads` ingestion) — see **[apps/sales-crm/README.md](apps/sales-crm/README.md)**.
It's independent of the platform's built-in opportunities pipeline
(`apps/api/gtm_api/routers/crm.py`) and not wired to it — its own SQLite DB and env vars.

```bash
make crm                                       # dev: go run ., → http://localhost:8080
cd apps/sales-crm && docker compose up -d --build   # or standalone container
```

**First login:** every deployment seeds a default admin account on startup if one doesn't
already exist — `marketing@zyvor.dev` / `Admin@321` (change this password immediately in any
real deployment; disable entirely with `SEED_DEFAULT_ADMIN=false`). `NEXT_PUBLIC_API_URL` in
`.env` must be an address a **visitor's browser** can reach (not `localhost`) —
`deploy-remote.sh` refuses to build with that left unset.

**TLS / production entrypoint:** Aurora is an **independent product** (the live app is not
reverse-proxied by [`hypersdk-web`](https://github.com/ssahani/hypersdk-web) /
[zyvor.dev](https://zyvor.dev)). Product marketing and trial download live on the website:

**→ [zyvor.dev/aurora](https://zyvor.dev/aurora)**

Production deploy for the app itself is the K3s stack in [`k8s/`](k8s/README.md):
`./scripts/deploy-k8s.sh <host> <user>` → HTTPS on **`https://<host>:30443`**. Sync local
`apps/web` to the remote deploy tree before rebuilding if you changed the frontend. Optional
compose nginx overlay: [infra/nginx/certs/README.md](infra/nginx/certs/README.md).

### Customer trial download (no source)

| | |
|---|---|
| Website | [zyvor.dev/aurora](https://zyvor.dev/aurora) |
| Distro repo | [`hypersdk/aurora`](https://github.com/hypersdk/aurora) |
| Latest release | [v0.1.0 — 30-day trial](https://github.com/hypersdk/aurora/releases/tag/v0.1.0) |
| Package | [`aurora-0.1.0.tar.gz`](https://github.com/hypersdk/aurora/releases/download/v0.1.0/aurora-0.1.0.tar.gz) |
| Checksum | [`aurora-0.1.0.tar.gz.sha256`](https://github.com/hypersdk/aurora/releases/download/v0.1.0/aurora-0.1.0.tar.gz.sha256) |
| After trial | Email **sales@zyvor.dev** for `AURORA_LICENSE_KEY` |
| Licensing notes | [docs/LICENSING.md](docs/LICENSING.md) |

Extract the archive and follow `INSTALL.md` inside (compose, Helm, or k3s). Build/publish
new packages from this repo with `./scripts/build-customer-package.sh` +
`./scripts/publish-trial-release.sh`.

## LLM Providers

The platform supports **both Ollama and OpenAI** via a single factory. Switch with env vars only:

| Setting | Ollama (dev default) | OpenAI (production) |
|---------|----------------------|---------------------|
| `LLM_PROVIDER` | `ollama` | `openai` |
| Chat models | Llama/Qwen/DeepSeek/Gemma per agent | GPT-4o / GPT-4o-mini per agent |
| Embeddings | `nomic-embed-text` (768d) | `text-embedding-3-small` (1536d) |
| Cost | Free (local compute) | Pay-per-token |

If `OPENAI_API_KEY` is set and `LLM_PROVIDER` is unset, OpenAI is auto-selected for backward compatibility.

Per-agent model routing:

| Agent | Ollama | OpenAI |
|-------|--------|--------|
| Product Understanding | qwen2.5-coder:14b | gpt-4o-mini |
| Marketing Strategy | deepseek-r1:8b | gpt-4o |
| Sales Chat | llama3.1:8b | gpt-4o-mini |
| Outreach | gemma2:9b | gpt-4o-mini |
| Solution Architect | deepseek-r1:8b | gpt-4o |

Check provider status: `GET /health`

Full plan, architecture, unit tests, and integration test guide: [docs/ollama-llm-integration.md](docs/ollama-llm-integration.md)

**Test case document (223 tests):** [docs/test-cases.md](docs/test-cases.md)

12-phase implementation status, acceptance criteria, and test matrix: [docs/gtm-platform-phases.md](docs/gtm-platform-phases.md)

Multi-agent composition plan (11 specialized agents, **lean hardware / persona-first**): [docs/multi-agent-composition-plan.md](docs/multi-agent-composition-plan.md)

**Role-based default landing** (persona routes after login): [docs/role-based-landing.md](docs/role-based-landing.md)

**Licensing** (30-day keyless trial, then `AURORA_LICENSE_KEY` from sales@zyvor.dev): [docs/LICENSING.md](docs/LICENSING.md)

Local dev setup, start/stop scripts, Makefile, and troubleshooting: [docs/dev-guide.md](docs/dev-guide.md)

## API Endpoints

- `POST /api/v1/auth/register` — Register tenant
- `POST /api/v1/products` — Onboard product
- `POST /api/v1/products/{id}/sources` — Add source
- `POST /api/v1/products/{id}/ingest` — Trigger ingestion
- `GET /api/v1/products/{id}/profile` — Product profile
- `POST /api/v1/products/{id}/query` — Grounded Q&A
- `POST /api/v1/products/{id}/strategy` — Generate GTM strategy
- `POST /api/v1/products/{id}/content` — Generate content
- `POST /api/v1/products/{id}/chat` — Sales agent chat
- `POST /api/v1/products/{id}/outreach` — Personalized outreach (optional `recipient_email` for suppression-aware publish)
- `POST /api/v1/products/{id}/architect` — Solution architect Q&A
- `POST /api/v1/products/{id}/proposals` — Generate proposal
- `POST /api/v1/artifacts/{id}/approve` — Approve/reject generated content
- `POST /api/v1/artifacts/{id}/publish` — Publish to a channel (blocked if recipient is suppressed)
- `POST /api/v1/products/{id}/campaigns`, `GET .../campaigns`, `GET .../campaigns/{id}/status` — Campaign management
- `GET /api/v1/products/{id}/opportunities/{opp_id}` — Opportunity detail
- `GET /api/v1/products/{id}/account-health` — Customer success account health
- `GET /api/v1/products/{id}/brief` — Executive brief incl. `gtm_readiness` (9 derived, no-LLM status booleans — sources/ingest/profile/strategy/discover/qualify/outreach/proposal/publish)
- `GET /api/v1/products/{id}/workflow-runs` — Recent/active `WorkflowRun`s for a product (powers the Full Forge run-log dock)
- `GET /api/v1/agents/registry` — Agent registry catalog
- `GET /api/v1/admin/plan` — Plan + usage
- `GET/POST /api/v1/admin/suppression` — Suppression list
- `GET /api/v1/admin/export` — Tenant data export (admin only)
- `POST /api/v1/admin/purge` — Tenant knowledge purge, typed-slug confirmation (admin only)
- `GET/POST/PUT/DELETE /api/v1/admin/workflow-stages` — Tenant-defined custom Full Forge stages (Enterprise plan only)

## Design system

Light-first **Apple.com-style** system: flat surfaces, SF/system typography tokens, pill
primary buttons, and an Apple-blue accent (`--primary`) defined in
`apps/web/src/app/globals.css`. Dark mode is opt-in via `html.dark-theme`
(`ThemeContext`). Legacy `.glass*` / `.tahoe-*` class names still exist as aliases to the
flat Apple styles for older call sites.

**Chrome:** `GlobalNav` (mega-menu flyouts) sits on marketing (`MarketingLayout`), app
(`AppShell`), product console (`ProductConsoleShell`), and portal auth pages. Marketing
home is `/` (`HomeSections`); sign-up/sign-in live at `/login`. New tenants get an
`OnboardingChecklist` on `/dashboard` and Full Forge until sources are ingested and an
agent has run.

The product workspace (`/products/[id]/*`) keeps a left rail + top tab bar under that same
`GlobalNav`, built around a derived 9-stage pipeline chain. See
[Frontend workspace](docs/gtm-platform-phases.md#frontend-workspace).

## License

Apache License 2.0
