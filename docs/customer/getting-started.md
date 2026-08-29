# Getting Started with Aurora

Shortest path from install → signed-in product → first useful result.

Trial binaries ship from the public distro repo (no source in the trial). Source developers use this application repo with `make start`.

## What you need

| Requirement | Notes |
|-------------|--------|
| Docker/Podman + compose | ~8 GB RAM free for first pull |
| Web | `http://<host>:3000` |
| API | `http://<host>:8000/health` |

## 1. Install (trial package)

Follow **GETTING-STARTED** in the trial tarball (infra compose → app compose → login).  
Source: `make start` → web `:3000`, API `:8000`.

## 2. Sign in

| Login | Password |
|-------|----------|
| Seeded admin (labs) | `marketing@zyvor.dev` / `Admin@321` — **change immediately** |
| SSO | When `SSO_ENABLED` + IdP configured |

Never publish lab host IPs — use `localhost` or your `<host>`.

## 3. First useful workflow

1. Open **GTM workspace** (`/dashboard`) → create/onboard a product (website or docs URL).
2. **Add a source** → **Ingest** — wait until status is **completed** (workers must be up).
3. Open **Full Forge** (`/products/:id`) or **Executive Brief**.
4. Run one agent action (Q&A / Strategy / Outreach) → **Approve** → **Publish** when ready.

## Next steps

- [Using the Dashboard](using-the-dashboard.md)
- [Admin basics](admin-basics.md)
- [Common workflows](workflows.md)
- [Page guides](pages/README.md)
