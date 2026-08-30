# Aurora — Local Development Guide

How to install, start, stop, and troubleshoot the platform on your machine.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Docker Desktop** | Latest | Required for Postgres, Qdrant, Neo4j, Redis, MinIO; Ollama via `--profile ollama` |
| **Python** | 3.12+ | Used via `apps/api/.venv` — do not use system Python 3.9 |
| **Node.js** | 18+ | For Next.js frontend |
| **LLM** | Ollama **or** OpenAI-compatible | Ollama optional (`brew` / compose profile). Labs often use Groq via `LLM_PROVIDER=openai` + `OPENAI_BASE_URL` |

---

## Quick start (recommended)

**1. Start Docker Desktop**

**2. One command to start everything:**

```bash
make start
```

This will:

- Create `.env` from `.env.example` if missing
- Create Python venv and install deps if missing
- Start all Docker services
- Wait for Postgres
- Initialize database tables
- Start API (`:8000`) and web (`:3000`) in the background
- **Start ARQ workers** when `ENABLE_REDIS_WORKERS=true` (default in full deployment) — required for **Ingest selected** in the Sources panel

**3. Open the app:**

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

**4. Stop when done:**

Close any **http://localhost:3000** browser tabs first (avoids Next.js HMR tab freezes), then:

```bash
make stop
```

Use `make stop-apps` to stop API/web/workers only and keep Docker running.

---

## Source ingest (Forge → Sources)

See **[source-management.md](./source-management.md)** for full details.

| UI | Workers needed? |
|----|-----------------|
| **Ingest selected** / **Ingest all** | Yes (async queue) |
| **Crawl & Ingest** (Overview button) | No (sync in API) |

**How to know ingest is running:** watch the Sources table — status moves `pending` → `crawling` → `processing` → `completed`, and the **Pages** column updates. Message **“Queued N source(s)”** with status stuck on `pending` and `0/0` means workers are not processing the queue.

```bash
tail -f .logs/workers.log    # crawl_complete when a source finishes
make workers                 # foreground workers if not auto-started
```

---

## First-time setup (manual)

Use this if you prefer step-by-step control, or if `make start` fails partway through.

```bash
# 1. Environment file
make env                 # cp .env.example → .env

# 2. LLM — pick one
# A) OpenAI-compatible (Groq, etc.): set LLM_PROVIDER=openai + OPENAI_* in .env
# B) Local Ollama:
brew install ollama && ollama serve && make ollama-pull
#    (compose: docker compose -f infra/docker-compose.yml --profile ollama up -d)

# 3. Infrastructure
make infra-up            # Docker Compose up + wait for Postgres

# 4. Dependencies
make install-api         # Python 3.12 venv + pip install
make install-web         # npm install

# 5. Database
make init-db             # create Postgres tables

# 6. Run (foreground — two terminals)
make api                 # terminal 1 → http://localhost:8000
make web                 # terminal 2 → http://localhost:3000
```

Or bootstrap steps 1–5 in one shot (does **not** start API/web):

```bash
make setup
make api    # terminal 1
make web    # terminal 2
```

---

## Start / stop scripts

### `make start` → `infra/scripts/start.sh`

Starts the full dev stack in the **background**.

```bash
make start
# equivalent:
./infra/scripts/start.sh
```

| Flag | Short | Effect |
|------|-------|--------|
| `--infra` | `-i` | Docker + DB init only (no API/web/workers) |
| `--apps` | `-a` | API + web only (infra must already be running) |
| `--workers` | `-w` | Force-start ARQ background workers |
| `--no-workers` | | Skip workers even when `ENABLE_REDIS_WORKERS=true` |
| `--skip-install` | | Skip pip/npm install checks |
| `--help` | `-h` | Show usage |

By default, **`make start` auto-starts workers** when `.env` has `DEPLOYMENT_PROFILE=full` (or anything other than `minimal`) and `ENABLE_REDIS_WORKERS` is not `false`.

**Examples:**

```bash
./infra/scripts/start.sh --infra          # just Docker + init-db
./infra/scripts/start.sh --apps           # API + web (infra already up)
./infra/scripts/start.sh --workers        # force workers on
./infra/scripts/start.sh --no-workers     # API + web only, no async ingest worker
./infra/scripts/start.sh --skip-install   # faster restart when deps exist
```

**Runtime files (gitignored):**

| Path | Purpose |
|------|---------|
| `.logs/api.log` | FastAPI / uvicorn output |
| `.logs/web.log` | Next.js dev server output |
| `.logs/workers.log` | ARQ worker output (async source ingest) |
| `.run/api.pid` | API process ID |
| `.run/web.pid` | Web process ID |
| `.run/workers.pid` | Workers process ID |

**Tail logs:**

```bash
tail -f .logs/api.log
tail -f .logs/web.log
tail -f .logs/workers.log
```

---

### `make stop` → `infra/scripts/stop.sh`

Stops dev processes and Docker. **Data volumes are preserved.**

**Before stopping:** close **http://localhost:3000** browser tabs (or the tab may hang when the Next.js dev server shuts down).

```bash
make stop
# equivalent:
./infra/scripts/stop.sh
```

| Flag | Short | Effect |
|------|-------|--------|
| `--processes` | `-p` | Stop uvicorn / Next.js / workers only (**keeps Docker**) |
| `--infra` | `-i` | `docker compose down` only |
| `--clean` | `-c` | Stop everything **and delete all Docker volumes** |
| `--help` | `-h` | Show usage |

Shutdown is **graceful** for Next.js (SIGINT + up to 25s wait) before force-kill. Use `make stop-apps` for a lighter restart without tearing down Postgres/Redis.

**What gets stopped:**

| Target | Method |
|--------|--------|
| Port 8000 | API (uvicorn) |
| Port 3000 | Web (Next.js) — graceful shutdown to close HMR websockets |
| `gtm_workers.main`, `arq.worker` | Background workers |
| Docker Compose | Postgres, Qdrant, Neo4j, Redis, MinIO, Ollama |

**Examples:**

```bash
make stop                              # processes + infra (keep data)
make stop-apps                         # processes only (keep Docker)
make clean                             # processes + infra + DELETE volumes
./infra/scripts/stop.sh --processes    # same as make stop-apps
./infra/scripts/stop.sh --infra        # docker down only
```

After `make clean`, run `make init-db` again on next start (empty database).

---

## Makefile reference

All commands run from the **repository root**.

| Target | Description |
|--------|-------------|
| `make start` | Full background start (infra + DB + API + web + workers when enabled in `.env`) |
| `make stop` | Stop processes + Docker (keep data) |
| `make stop-apps` | Stop API/web/workers only (keep Docker) |
| `make clean` | Stop everything + remove Docker volumes |
| `make setup` | First-time bootstrap: env + infra + install + init-db |
| `make env` | Create `.env` from `.env.example` |
| `make infra-up` | Start Docker Compose + wait for Postgres |
| `make infra-down` | Stop Docker Compose (keep volumes) |
| `make check-infra` | Verify Docker and Postgres are running |
| `make install-api` | Create `apps/api/.venv` (Python 3.12) + pip install |
| `make install-web` | `npm install` in `apps/web` |
| `make install` | Both install-api and install-web |
| `make init-db` | Create Postgres tables (idempotent) |
| `make api` | Run API in **foreground** (uses venv uvicorn) |
| `make web` | Run Next.js in **foreground** |
| `make workers` | Run ARQ workers in **foreground** |
| `make test` | Run pytest (223 tests) |
| `make ollama-pull` | Pull MVP Ollama models |

### Important: always use the venv

`make api`, `make test`, and `make start` use `apps/api/.venv` (Python **3.12**).

Do **not** run bare `uvicorn` or `python` from system Python 3.9 — you will get `ModuleNotFoundError: bcrypt` and similar errors.

```bash
# Correct
make api
cd apps/api && .venv/bin/uvicorn gtm_api.main:app --reload --port 8000

# Wrong (system Python)
uvicorn gtm_api.main:app --reload --port 8000
```

---

## Infrastructure services

Defined in [`infra/docker-compose.yml`](../infra/docker-compose.yml).

| Service | Port(s) | Purpose |
|---------|---------|---------|
| **postgres** | 5432 | Primary relational DB (`gtm_platform`) |
| **qdrant** | 6333, 6334 | Vector store for RAG chunks |
| **neo4j** | 7474, 7687 | Knowledge graph (browser UI on 7474) |
| **redis** | 6379 | Cache + ARQ job queue |
| **minio** | 9000, 9001 | Object storage (console on 9001) |
| **ollama** | 11434 | Local LLM (optional; host Ollama preferred on Mac) |

**Default credentials** (dev only — change for production):

| Service | User | Password |
|---------|------|----------|
| Postgres | `gtm` | `gtm_dev` |
| Neo4j | `neo4j` | `gtm_dev_neo4j` |
| MinIO | `gtm_minio` | `gtm_minio_dev` |

**Docker volumes** (persist data between restarts):

- `postgres_data`, `qdrant_data`, `neo4j_data`, `redis_data`, `minio_data`, `ollama_data`

Removed by `make clean`.

---

## Environment configuration

Copy and edit:

```bash
make env    # creates .env from .env.example
```

Key variables:

```bash
# Database (must match docker-compose)
DATABASE_URL=postgresql+asyncpg://gtm:gtm_dev@localhost:5432/gtm_platform

# LLM provider: ollama | openai
LLM_PROVIDER=ollama

# Ollama (default dev)
OLLAMA_BASE_URL=http://localhost:11434/v1

# OpenAI (production)
OPENAI_API_KEY=sk-...

# Frontend proxy target (Next.js rewrites /api → FastAPI)
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Full LLM configuration: [ollama-llm-integration.md](./ollama-llm-integration.md)

---

## Health checks

```bash
curl -s http://localhost:8000/health | python3 -m json.tool
```

Example response:

```json
{
  "status": "healthy",
  "service": "Aurora",
  "db_ready": true,
  "db_message": null,
  "llm_provider": "ollama",
  "llm_ready": true,
  "embedding_model": "nomic-embed-text",
  "embedding_dimensions": 768,
  "chat_models": { "sales_agent": "llama3.1:8b" }
}
```

| Field | Meaning |
|-------|---------|
| `status` | `healthy` if DB up, `degraded` if DB down |
| `db_ready` | Postgres reachable |
| `llm_ready` | Ollama reachable or OpenAI key set |
| `missing_models` | Ollama models not yet pulled |

---

## Ollama setup

```bash
# Option A: Host Ollama (recommended on Mac)
brew install ollama
ollama serve              # keep running
make ollama-pull          # llama3.1, qwen2.5-coder, deepseek-r1, gemma2, nomic-embed-text

# Option B: Docker Ollama (already in docker-compose)
make infra-up             # includes ollama service
docker exec -it $(docker compose -f infra/docker-compose.yml ps -q ollama) ollama pull llama3.1:8b
```

Verify:

```bash
curl http://localhost:11434/api/tags
```

---

## Testing

```bash
make test
# or
cd apps/api && .venv/bin/python -m pytest tests/ -v
```

223 tests covering auth, RBAC, chunking, citation gate, crawler SSRF, supervisor routing, LLM factory, publishing/suppression, admin routes, and HTTP health checks.

See also:

- [test-cases.md](./test-cases.md) — **canonical test case document** (IDs, preconditions, expected results)
- [ollama-llm-integration.md](./ollama-llm-integration.md) — LLM unit + integration tests
- [gtm-platform-phases.md](./gtm-platform-phases.md) — 12-phase test matrix

---

## Troubleshooting

### `ConnectionRefusedError` on register/login

**Cause:** Postgres is not running.

**Fix:**

```bash
# Start Docker Desktop, then:
make infra-up
make init-db
curl http://localhost:8000/health   # db_ready should be true
```

Register/login now returns **503** with a helpful message when DB is down (instead of a stack trace).

---

### `ModuleNotFoundError: No module named 'bcrypt'`

**Cause:** Using system Python 3.9 instead of project venv.

**Fix:**

```bash
make install-api
make api          # uses .venv automatically
```

---

### Port already in use (8000 or 3000)

```bash
make stop-apps    # graceful stop; keeps Docker
# or full stop:
make stop
```

Avoid `kill -9` on port 3000 while a browser tab is open — it can freeze the tab.

---

### Browser tab freezes after `make stop`

**Cause:** Next.js dev HMR websocket lost connection (especially in Cursor’s embedded browser).

**Fix:**
1. **Before** `make stop`, close the `localhost:3000` tab (Cmd+W).
2. `make stop` now waits 3s when Next.js is running, stops **web first** (up to 40s SIGINT grace), then API/workers.
3. The app injects an early HMR guard in `<head>` to stop infinite reconnect loops after the dev server dies.

If a tab is already frozen, force-close it and run `make start` again — do not reload the stuck tab.

**Lighter stop** (keeps Docker): `make stop-apps`

---

### Source ingest stuck on `pending` / “Queued”

**Cause:** Async ingest was queued but ARQ workers are not running.

**Fix:**

```bash
make start                    # auto-starts workers when ENABLE_REDIS_WORKERS=true
# or
make workers                  # foreground workers in this terminal
tail -f .logs/workers.log     # confirm crawl_complete
```

Alternatively use **Crawl & Ingest** on Forge Overview (sync — no workers).

See [source-management.md](./source-management.md).

---

### Docker not running

```
error: Docker is not running. Start Docker Desktop first.
```

Open Docker Desktop and wait until it is ready, then `make start`.

---

### `db_ready: false` but Docker is up

```bash
make check-infra
make init-db
docker compose -f infra/docker-compose.yml logs postgres
```

---

### Ollama `missing_models` in `/health`

```bash
make ollama-pull
# or manually:
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

---

### Fresh start (wipe all local data)

```bash
make clean        # stops + deletes Docker volumes
make start        # re-bootstrap from scratch
```

You will need to register a new tenant in the web UI.

---

### Web UI can't reach API

Next.js proxies `/api/*` → `http://localhost:8000/api/v1/*` (see `apps/web/next.config.js`).

Ensure:

1. API is running on port 8000
2. You registered/logged in (JWT stored in `localStorage`)

---

## Project layout

```
apps/
  api/           FastAPI + LangGraph agents (Python 3.12 venv)
  web/           Next.js frontend
  workers/       ARQ background jobs
infra/
  docker-compose.yml
  scripts/
    start.sh     make start
    stop.sh      make stop / make clean
    pull-models.sh   make ollama-pull
scripts/
  deploy-remote.sh          SSH deploy of the Docker Compose stack to a remote host
  test-deploy-remote-e2e.sh smoke test an existing (or fresh) remote deploy
docker-compose.prod.yml     api/web/workers images, overlaid on infra/docker-compose.yml
.env.prod.example
docs/
  dev-guide.md           ← this file
  test-cases.md          ← canonical test inventory
  gtm-platform-phases.md 12-phase status (also covers containerized/remote deploy)
  ollama-llm-integration.md
.env.example
Makefile
```

---

## Typical daily workflow

```bash
# Morning
make start
tail -f .logs/workers.log  # optional — confirm async ingest is ready

# Develop
# edit code — API from make start has no --reload; use make api for hot reload

# Run tests
make test

# Evening — close localhost:3000 tabs first
make stop
```

---

## Related docs

| Document | Contents |
|----------|----------|
| [source-management.md](./source-management.md) | Source types, ingest status, workers, troubleshooting |
| [sso-oidc.md](./sso-oidc.md) | Keycloak / OIDC SSO, demo logins (`demo`/`demo`, `marketing@zyvor.dev`/`Admin@321`) |
| [role-based-landing.md](./role-based-landing.md) | Persona default routes by RBAC role (login redirect, dashboard CTAs) |
| [test-cases.md](./test-cases.md) | Full test case document — 223 tests with IDs, preconditions, expected results |
| [gtm-platform-phases.md](./gtm-platform-phases.md) | 12-phase implementation status + acceptance criteria |
| [ollama-llm-integration.md](./ollama-llm-integration.md) | Dual LLM provider (Ollama + OpenAI) + tests |
| [README.md](../README.md) | Project overview + API endpoint list |
