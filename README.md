# Aurora

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
[![CI](https://github.com/zyvorai/aurora/actions/workflows/ci.yml/badge.svg)](https://github.com/zyvorai/aurora/actions/workflows/ci.yml)

**Turn your technical product into an AI-powered salesperson.**

Multi-tenant SaaS platform where software companies onboard by providing a
website or documentation. The platform automatically discovers the product,
builds a searchable knowledge graph + RAG store, then runs AI marketing,
sales, and solution agents.

## Which repo am I in?

| You want to… | Use |
|--------------|-----|
| **Self-host from source** (AGPL, free for home) | This repo — `make start` below |
| **Commercial license (ACL)** | [sales@zyvor.dev](mailto:sales@zyvor.dev) · [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) |
| Product marketing / schedule a demo | [zyvor.dev/aurora](https://zyvor.dev/aurora) |

This repository is the **open-source application** (AGPL-3.0).
Organizations that need freedom from AGPL can buy an [Aurora Commercial License](COMMERCIAL_LICENSE.md).

## Contents

- [Dashboard gallery](#dashboard-gallery)
- [Features](#features)
- [Architecture](#architecture)
- [Stack](#stack)
- [Repository](#repository)
- [Quick Start](#quick-start-developers-with-source)
- [LLM Providers](#llm-providers)
- [API Endpoints](#api-endpoints)
- [Design system](#design-system)
- [Important boundaries](#important-boundaries)
- [License](#license)

## Dashboard gallery

![Aurora marketing home — turn your product into an AI salesperson](docs/ux/00-home.png)

![Aurora sign in — two-step email/password or SSO](docs/ux/01-login.png)

![GTM workspace — product portfolio with onboarding, search, and ready/setup filters](docs/ux/02-dashboard.png)

![Full Forge — the 9-stage GTM pipeline (Sources → Ingest → Strategy → … → Publish) with the run log dock](docs/ux/03-workspace.png)

![Executive Brief — accounts, qualified leads, conversations, and GTM readiness, computed without an LLM call](docs/ux/04-brief.png)

![Sales Action — Discover/Qualify/Outreach/Pipeline tabs for account discovery and CSV import](docs/ux/05-sales.png)

![Admin — Workflow Stages, an Enterprise-plan feature for tenant-defined pipeline stages](docs/ux/06-admin.png)

## Features

### Knowledge & discovery

- Onboard a product from a website, docs, CSV, YouTube, GitHub, or an
  OpenAPI spec — see [docs/source-management.md](docs/source-management.md).
- Automatic knowledge graph (Neo4j) + RAG store (Qdrant) built from ingested
  sources, with grounded Q&A (`POST /products/{id}/query`).

### AI sales & marketing agents

- Marketing strategy and content generation, sales chat, personalized
  outreach (suppression-aware publish), solution-architect Q&A, and proposal
  generation — one LLM factory, swap Ollama ↔ OpenAI-compatible per agent.
  See [docs/ollama-llm-integration.md](docs/ollama-llm-integration.md).
- 11 specialized agents behind a supervisor, lean-hardware-first design. See
  [docs/multi-agent-composition-plan.md](docs/multi-agent-composition-plan.md).
- Campaign management and channel publishing across email, LinkedIn, X,
  Medium, dev.to, and Reddit adapters.

### Workspace & admin

- Persona-based default landing after login (exec / sales / marketing). See
  [docs/role-based-landing.md](docs/role-based-landing.md).
- Executive Brief with a 9-signal `gtm_readiness` status — computed without
  an LLM call on load.
- Admin: plan/usage, suppression list, tenant data export, tenant purge,
  and Enterprise-plan custom workflow stages.
- Customer / reseller / salesperson external portals.
- Optional standalone Sales CRM microservice
  ([`apps/sales-crm`](apps/sales-crm/README.md)) — Kanban pipeline, SLA
  timers, round-robin owners; independent of the built-in opportunities
  pipeline.
- SSO/OIDC — bundled Keycloak demo IdP or bring your own IdP. See
  [docs/sso-oidc.md](docs/sso-oidc.md).

## Architecture

```text
Customer Sources → Product Discovery → Knowledge Extraction → AI Knowledge Graph
                                                                    ↓
                    Marketing AI ← Supervisor → Sales AI → Solution AI
                                    ↓
                    Omnichannel Publishing → Analytics → Continuous Learning
```

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, Tailwind CSS |
| Backend | FastAPI (Python) |
| Agents | LangChain, LangGraph |
| LLM (dev) | Ollama (`--profile ollama`) or OpenAI-compatible |
| LLM (lab / Zyvor-owned) | OpenAI-compatible chat (e.g. Groq) via `LLM_PROVIDER=openai` |
| LLM (customer prod) | OpenAI or your compatible gateway |
| Vector DB | Qdrant |
| Knowledge Graph | Neo4j |
| Relational DB | PostgreSQL |
| Cache/Queue | Redis |
| Object Storage | MinIO |

## Repository

| Path | What's there |
|------|---------------|
| [`apps/web`](apps/web) | Next.js/React frontend — marketing site, dashboard, product workspace. |
| `apps/api` | FastAPI backend — agents, knowledge graph/RAG, admin APIs. |
| [`apps/sales-crm`](apps/sales-crm/README.md) | Standalone Go lead/deal-pipeline CRM microservice — own SQLite DB, not wired to the platform pipeline. |
| [`docs/`](docs/README.md) | Operator/developer docs — dev guide, licensing, LLM integration, SSO, test cases. |
| [`docs/customer/`](docs/customer/README.md) | Customer-facing docs: getting started, page-by-page guides, printable PDFs. |
| [`k8s/`](k8s/README.md) | K3s manifests for the standalone production deploy (HTTPS `:30443`). |
| `infra/` | Docker Compose stack, Keycloak realm, optional nginx TLS overlay. |
| `scripts/` | Remote/K8s deploy, demo-suite seeding, and `docs/customer/` generation scripts. |

The public docs site at [zyvor.dev/aurora](https://zyvor.dev/aurora) is
synced from `docs/customer/` via `scripts/customer-docs/sync-to-website.mjs`
— edit the markdown here, not the live site.

## Quick Start (developers with source)

**Requires Docker Desktop running.**

```bash
make start    # infra + DB + API + web (background)
# → http://localhost:3000  (web)
# → http://localhost:8000  (api)
# Sign in (2-step): marketing@zyvor.dev → Continue → Admin@321
make stop     # when done
```

Full install paths (containerized/production, remote K3s, sales CRM), demo
logins, and a page-by-page nav table: **[QUICKSTART.md](QUICKSTART.md)**.
Full local setup and troubleshooting: [docs/dev-guide.md](docs/dev-guide.md).

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
- `GET /api/v1/products/{id}/workflow-runs` — Recent/active `WorkflowRun`s for a product (powers the Workspace run-log dock)
- `GET /api/v1/agents/registry` — Agent registry catalog
- `GET /api/v1/admin/plan` — Plan + usage
- `GET/POST /api/v1/admin/suppression` — Suppression list
- `GET /api/v1/admin/export` — Tenant data export (admin only)
- `POST /api/v1/admin/purge` — Tenant knowledge purge, typed-slug confirmation (admin only)
- `GET/POST/PUT/DELETE /api/v1/admin/workflow-stages` — Tenant-defined custom Workspace stages (Enterprise plan only)

## Design system

Light-first **Apple.com-style** system keyed to **iPhone 17** finishes: Cosmic Orange
primary (`--primary` `#f77e2d`), Mist Blue / Sage / Lavender / Deep Blue accents, SF/system
typography, and pill CTAs in `apps/web/src/app/globals.css`. Informational text links use
Mist Blue (`--accent-blue`). Dark mode is opt-in via `html.dark-theme` (`ThemeContext`).
Legacy `.glass*` / `.tahoe-*` class names remain as **aliases** for flat Apple panels
(hairline border, no decorative shadow by default).

**Chrome:** `GlobalNav` (mega-menu flyouts) sits on marketing (`MarketingLayout`), app
(`AppShell`), product console (`ProductConsoleShell`), and portal auth pages. Marketing
home is `/` (`HomeSections`); sign-up/sign-in live at `/login` with the same Cosmic Orange
auth language as `PortalAuthShell`. New tenants get an
`OnboardingChecklist` on `/dashboard` and Workspace until sources are ingested and an
agent has run.

The product workspace (`/products/[id]/*`) keeps a left rail + top tab bar under that same
`GlobalNav`, built around a derived 9-stage pipeline chain. See
[Frontend workspace](docs/gtm-platform-phases.md#frontend-workspace).

## Important boundaries

What's free under AGPL vs. what needs a commercial license
([full guide](docs/LICENSING.md)):

| Use case | Allowed under AGPL? |
| --- | --- |
| Self-host for home or your own operations | Yes, free |
| Modify for internal use | Yes, free |
| Build and publish your own AGPL extensions | Yes, free |
| Deploy modified Aurora as public SaaS without releasing changes | No — needs ACL |
| Embed Aurora in a closed-source product | No — needs ACL |
| White-label proprietary customizations without AGPL | No — needs ACL |

`apps/sales-crm` and the platform's built-in opportunities pipeline are
deliberately independent services — don't assume one implies the other.

## License

Dual-licensed:

- **[AGPL-3.0](LICENSE)** — open source; free for home users and self-host under AGPL terms
- **[Aurora Commercial License (ACL)](COMMERCIAL_LICENSE.md)** — proprietary integrations, freedom from AGPL obligations, support

See [docs/LICENSING.md](docs/LICENSING.md).
