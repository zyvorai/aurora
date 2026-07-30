# GTM Platform — Local Development Guide

How to install, start, stop, and troubleshoot the platform on your machine.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Docker Desktop** | Latest | Required for Postgres, Qdrant, Neo4j, Redis, MinIO, Ollama (Docker) |
| **Python** | 3.12+ | Used via `apps/api/.venv` — do not use system Python 3.9 |
| **Node.js** | 18+ | For Next.js frontend |
| **Ollama** (optional) | Latest | Recommended on macOS via `brew install ollama` (faster than Docker Ollama) |

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

**3. Open the app:**

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

**4. Stop when done:**

```bash
make stop
```

---

## First-time setup (manual)

Use this if you prefer step-by-step control, or if `make start` fails partway through.

```bash
# 1. Environment file
make env                 # cp .env.example → .env

# 2. LLM (optional — Ollama is default)
brew install ollama
ollama serve             # separate terminal
make ollama-pull         # download MVP models

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
| `--infra` | `-i` | Docker + DB init only (no API/web) |
| `--apps` | `-a` | API + web only (infra must already be running) |
| `--workers` | `-w` | Also start ARQ background workers |
| `--skip-install` | | Skip pip/npm install checks |
| `--help` | `-h` | Show usage |

**Examples:**

```bash
./infra/scripts/start.sh --infra          # just Docker + init-db
./infra/scripts/start.sh --apps           # API + web (infra already up)
./infra/scripts/start.sh --workers        # full start + workers
./infra/scripts/start.sh --skip-install   # faster restart when deps exist
```

**Runtime files (gitignored):**

| Path | Purpose |
|------|---------|
| `.logs/api.log` | FastAPI / uvicorn output |
| `.logs/web.log` | Next.js dev server output |
| `.logs/workers.log` | ARQ worker output (with `--workers`) |
| `.run/api.pid` | API process ID |
| `.run/web.pid` | Web process ID |
| `.run/workers.pid` | Workers process ID |

**Tail logs:**

```bash
tail -f .logs/api.log
tail -f .logs/web.log
```

---

### `make stop` → `infra/scripts/stop.sh`

Stops dev processes and Docker. **Data volumes are preserved.**

```bash
make stop
# equivalent:
./infra/scripts/stop.sh
```

| Flag | Short | Effect |
|------|-------|--------|
| `--processes` | `-p` | Stop uvicorn / Next.js / workers only |
| `--infra` | `-i` | `docker compose down` only |
| `--clean` | `-c` | Stop everything **and delete all Docker volumes** |
| `--help` | `-h` | Show usage |

**What gets stopped:**

| Target | Method |
|--------|--------|
| Port 8000 | API (uvicorn) |
| Port 3000 | Web (Next.js) |
| `gtm_workers.main`, `arq.worker` | Background workers |
| Docker Compose | Postgres, Qdrant, Neo4j, Redis, MinIO, Ollama |

**Examples:**

```bash
make stop                              # processes + infra (keep data)
make clean                             # processes + infra + DELETE volumes
./infra/scripts/stop.sh --processes    # kill API/web only
./infra/scripts/stop.sh --infra        # docker down only
```

After `make clean`, run `make init-db` again on next start (empty database).

---

## Makefile reference

All commands run from the **repository root**.

| Target | Description |
|--------|-------------|
| `make start` | Full background start (infra + DB + API + web) |
| `make stop` | Stop processes + Docker (keep data) |
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
| `make test` | Run pytest (60 tests) |
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
  "service": "GTM Agent Platform",
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

60 tests covering auth, RBAC, chunking, citation gate, crawler SSRF, supervisor routing, LLM factory, and HTTP health checks.

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
make stop
# or force-kill:
lsof -ti tcp:8000 | xargs kill
lsof -ti tcp:3000 | xargs kill
```

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
docs/
  dev-guide.md           ← this file
  test-cases.md          ← canonical test inventory (60 cases)
  gtm-platform-phases.md 12-phase status
  ollama-llm-integration.md
.env.example
Makefile
```

---

## Typical daily workflow

```bash
# Morning
make start
tail -f .logs/api.log    # optional

# Develop
# edit code — uvicorn --reload picks up API changes automatically

# Run tests
make test

# Evening
make stop
```

---

## Related docs

| Document | Contents |
|----------|----------|
| [test-cases.md](./test-cases.md) | Full test case document — 60 tests with IDs, preconditions, expected results |
| [gtm-platform-phases.md](./gtm-platform-phases.md) | 12-phase implementation status + acceptance criteria |
| [ollama-llm-integration.md](./ollama-llm-integration.md) | Dual LLM provider (Ollama + OpenAI) + tests |
| [README.md](../README.md) | Project overview + API endpoint list |
