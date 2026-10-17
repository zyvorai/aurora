# Try Aurora in five minutes (PoC)

Four containers (Postgres, Qdrant, the API and the web app), prebuilt images, nothing to build. Your data stays on your machine.

## Install

| OS | Command |
|---|---|
| **macOS / Linux** | `curl -fsSL https://zyvorai.github.io/aurora/install.sh \| bash` |
| **Windows** (PowerShell, Docker Desktop with WSL2) | `irm https://zyvorai.github.io/aurora/install.ps1 \| iex` |
| **Kubernetes** | `./scripts/poc/install-k8s.sh` (see below, coming with the Helm PoC chart) |
| **No script, just Docker** | download [`docker-compose.poc.yml`](https://zyvorai.github.io/aurora/docker-compose.poc.yml), then `docker compose -f docker-compose.poc.yml up -d --wait` |

You need Docker (Docker Desktop on macOS/Windows, Docker Engine + Compose v2 on Linux) and about 4 GB of free RAM.
The installer asks which LLM to use, generates secrets, starts everything and opens **http://localhost:3000**.

Sign in with `marketing@zyvor.dev` / `Admin@321` (a seeded demo account: change it for anything beyond a throwaway test).

## Choose an LLM

| Option | Set in `~/.aurora-poc/.env` | Notes |
|---|---|---|
| OpenAI-compatible API | `LLM_PROVIDER=openai`, `OPENAI_API_KEY=…` (optional `OPENAI_BASE_URL`, `OPENAI_MODEL`) | Easiest. Embeddings use the provider's embedding model. |
| Ollama on your computer | `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://host.docker.internal:11434/v1` | Free and private. Run `ollama pull llama3.1:8b` and `ollama pull nomic-embed-text`; set `OLLAMA_HOST=0.0.0.0` so Docker can reach it. On Apple Silicon Ollama uses the GPU. |

Embedding dimensions differ (OpenAI 1536, Ollama 768). Pick one and stick to it; switching later needs `aurora-poc reset`.

## Everyday commands

`~/.aurora-poc/aurora-poc <command>` (Windows: `& "$HOME\.aurora-poc\aurora-poc.ps1" <command>`)

| Command | What it does |
|---|---|
| `status` | containers and `/health` |
| `logs [service]` | follow logs (`api`, `web`, `postgres`, `qdrant`) |
| `down` / `up` | stop / start (data is kept) |
| `update` | pull newer images and restart |
| `llm` | change the LLM settings |
| `reset` | delete all PoC data and start fresh |
| `feedback` | open the feedback form pre-filled with your OS |
| `uninstall` | remove containers, data and the install directory |

Data lives in Docker volumes `aurora-poc_postgres_data` and `aurora-poc_qdrant_data`. Secrets are in `~/.aurora-poc/.env` (mode 600).
Change the web port with `AURORA_PORT=3100` before installing.

## What to try

1. **Create a product** from your website or docs URL, then ingest it.
2. **SEO** tab: audit a public page, research keywords (estimates are labelled), score a draft.
3. **Content**: generate an `seo_article`, approve it, publish (WordPress/Dev.to/… need credentials).

## Troubleshooting

- **Port 3000 busy**: `AURORA_PORT=3100 aurora-poc install`.
- **"Docker is not running"**: start Docker Desktop and retry.
- **Agents say the LLM is not ready**: run `aurora-poc llm`, and check `aurora-poc status` shows `llm_ready: true`.
- **Windows**: the script is written and linted but has not been run on a real Windows machine yet; please report anything odd.
- **Apple Silicon / ARM Linux**: images are multi-arch (amd64 + arm64).

## Tell us how it went

`aurora-poc feedback` opens a short form (ease of install, what worked, what hurt). Or open
[an issue](https://github.com/zyvorai/aurora/issues/new/choose).

## Under the hood

`docker-compose.poc.yml` runs `DEPLOYMENT_PROFILE=minimal` (no Neo4j, Redis workers or MinIO; artifacts live in Postgres and
workflows run in the API process). The web container proxies `/api/v1` to the API at runtime (`API_INTERNAL_URL`), so the
same prebuilt image works behind any host name. For production topologies see `docs/dev-guide.md` and `k8s/README.md`.
