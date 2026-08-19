# SalesPulse CRM

Aggressive lead-tracking CRM microservice in Go.  
Runs as its **own pod** next to your web app and talks over HTTP + JSON.

## Highlights

| Feature | Detail |
|---------|--------|
| **UI password auth** | Set `CRM_UI_PASSWORD` — login required for HTML UI |
| **Round-robin owners** | `CRM_OWNERS=Asha,Ravi,Priya` assigns new leads automatically |
| **SLA timer** | `CRM_SLA_HOURS=2` — flag leads with no call/email/WhatsApp/meeting |
| **Hot leads** | Score ≥ 70 surfaced first |
| **Drag-and-drop pipeline** | Move stages on the Kanban board |
| **Quick activity log** | One-click call / email / WhatsApp / no-answer |
| **`POST /api/leads`** | Website form → contact + deal + activity |
| **Email dedupe** | Same email reuses the contact |
| **CSV export** | `/export/deals.csv` |
| **API key** | Optional `X-API-Key` on `/api/*` |

## Quick start

```bash
go build -o salespulse .
./salespulse
# → http://localhost:8080
```

```bash
CRM_UI_PASSWORD=changeme \
CRM_OWNERS=Asha,Ravi,Priya \
CRM_SLA_HOURS=2 \
CRM_API_KEY=dev-secret \
./salespulse
```

```bash
docker compose up -d --build
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Listen port |
| `CRM_DB` | `crm.db` | SQLite path |
| `CRM_API_KEY` | _(empty)_ | Required on `/api/*` when set |
| `CRM_CORS_ORIGINS` | `*` | Allowed origins |
| `CRM_SEED` | `true` | Seed sample data if empty |
| `CRM_UI_PASSWORD` | _(empty)_ | Enable UI login when set |
| `CRM_UI_SECRET` | derived | HMAC secret for session cookie |
| `CRM_SLA_HOURS` | `2` | Hours to first real contact (0 = off) |
| `CRM_OWNERS` | _(empty)_ | Comma-separated round-robin owners |

## Feed leads

```bash
curl -X POST http://crm:8080/api/leads \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{
    "name": "Anita Desai",
    "email": "anita@brighttech.in",
    "company": "BrightTech",
    "title": "Enterprise inquiry",
    "value": 250000,
    "source": "Website",
    "campaign": "pricing-page"
  }'
```

Owner is assigned from `CRM_OWNERS` when omitted.

## API (summary)

- `GET /api/stats` — includes `sla_breach_count`
- `GET /api/deals?filter=hot|overdue|stale|sla|new_today`
- `POST /api/leads` — ingest
- Full CRUD on deals & contacts
- `PUT /api/deals/{id}/stage`
- `GET /export/deals.csv`

## Architecture

```
Your Web App  ──HTTP + X-API-Key──►  SalesPulse CRM (ClusterIP)
                                     └── SQLite on PVC (replicas: 1)
```

UI is password-protected when `CRM_UI_PASSWORD` is set. API stays key-based.

## License

MIT
