# Source management

Admins and editors can add **knowledge sources** for a product in **Full Forge → Overview → Sources**.

## Supported source types

| Type | How to add | Ingest behavior |
|------|------------|-----------------|
| Website / docs / blog | URL | Multi-page crawl (same domain) |
| Document | Upload PDF, DOCX, PPT, TXT, MD | Text extraction |
| Spreadsheet | Upload CSV or XLSX | Tables as markdown |
| YouTube | Video URL | Captions via YouTube transcript API |
| Audio / video file | Upload | Whisper transcription (if enabled) + ffmpeg for video |
| GitHub | Repo URL (+ optional PAT) | README + docs markdown |
| OpenAPI | Spec URL or file upload | Paths and schemas as text |
| Database | Live read-only connection or SQL/CSV upload | Table rows serialized to text |

## Admin workflow

1. Log in as **admin** or **editor**.
2. Open **Full Forge** for your product.
3. In **Knowledge → Sources**, click **+ Add source**.
4. Pick a type, fill in URL / upload / DB credentials.
5. Enable **Start ingest after adding** (recommended).
6. After ingest completes, run **Build profile** (Workspace **Next up** card) and use **Q&A** to verify citations.

### Build profile and LLM limits

Profile extraction retrieves a capped slice of ingested chunks (per-chunk and total token budgets) so requests stay within provider limits (e.g. Groq on-demand ~8k TPM). The agent scopes extraction to the **product name** so shared pages like “Get started” do not bleed in other products. If build fails, the run log shows a user-safe message (not raw provider JSON).

## How to tell if ingest is running

The **Sources** table shows live status. After you trigger ingest, the UI polls every 3 seconds for up to ~2 minutes.

| UI signal | Meaning |
|-----------|---------|
| Message **“Queued N source(s) for ingest”** | Job was placed on the Redis queue (async ingest). |
| Status **`pending`** + Pages **`0/0`** | Waiting for a worker — **not processing yet**. |
| Status **`crawling`** | Loader is running (fetch URL, captions, repo files, etc.). |
| Status **`processing`** | Chunking and embedding in progress. |
| Pages **`N/M`** increasing | Active progress (common on website crawls). |
| Status **`completed`** | Done — run **Build profile** in Workspace. |
| Status **`failed`** + yellow error | Stopped — read the error under the badge. |

### Two ways to ingest

| Button | Mode | Workers required? |
|--------|------|-------------------|
| **Ingest selected** / **Ingest all** (Sources panel) | Async (`async_mode: true`) | **Yes** — ARQ workers must be running |
| **Crawl & Ingest** (Forge Overview, below Sources) | Sync (runs in API process) | No — browser waits until finished |

### Verify workers are running

```bash
# After make start (workers auto-start when ENABLE_REDIS_WORKERS=true)
tail -f .logs/workers.log

# Or run workers in a foreground terminal
make workers
```

Look for `crawl_complete` in the worker log when a source finishes.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/products/{id}/sources` | List sources |
| POST | `/products/{id}/sources` | Add URL-based source |
| POST | `/products/{id}/sources/upload` | Multipart file upload |
| POST | `/products/{id}/sources/database` | Live read-only DB source |
| POST | `/products/{id}/sources/database/test` | Test DB connection, list tables |
| DELETE | `/products/{id}/sources/{source_id}` | Remove source and indexed chunks |
| POST | `/products/{id}/ingest` | Ingest all or selected sources |

### Ingest request body

```json
{
  "source_ids": ["uuid-optional"],
  "force": false,
  "async_mode": true
}
```

When Redis workers are running (`make start` with workers enabled, or `make workers`), async ingest runs in the background. If workers are unavailable, the API falls back to **synchronous** ingest in the same request.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `UPLOAD_MAX_BYTES` | 104857600 | Max file upload (100MB) |
| `UPLOAD_MAX_MEDIA_BYTES` | 524288000 | Max audio/video upload (500MB) |
| `WHISPER_ENABLED` | false | Enable local Whisper transcription |
| `DB_SOURCE_MAX_ROWS_PER_TABLE` | 10000 | Cap rows per DB table |
| `DEPLOYMENT_PROFILE` | full | Set `minimal` to disable Redis workers |
| `ENABLE_REDIS_WORKERS` | true | Async ingest via ARQ (auto-started by `make start` when true) |

## Storage

Uploaded files are stored in MinIO at:

`{tenant_id}/{product_id}/{source_id}/{filename}`

Database and GitHub credentials are encrypted at rest using the API `SECRET_KEY`.

## Roles

| Role | Add / ingest / delete | View list |
|------|----------------------|-----------|
| admin | Yes | Yes |
| editor | Yes | Yes |
| approver | No | Yes |
| viewer | No | Yes |

## Troubleshooting

- **“Queued” but status stays `pending` with `0/0`** — Workers are not running. Run `make workers` or `make start` (workers auto-start when `ENABLE_REDIS_WORKERS=true`). Watch `.logs/workers.log`.
- **Ingest stays `pending` after workers started** — Check Redis is up (`make infra-up`), then restart workers: `make stop-apps && make start`.
- **YouTube no transcript** — Video must have captions; otherwise only metadata is stored.
- **Video file fails** — Install `ffmpeg`; set `WHISPER_ENABLED=true` for transcription.
- **MinIO errors** — Run `make infra-up`; check MinIO at localhost:9000.

See also: [dev-guide.md](./dev-guide.md) for start/stop scripts and daily workflow.
