# Getting Started with Aurora

Shortest path from install → signed-in product → first useful result.

Trial binaries ship from the public distro repo (no source in the trial). Source developers use this application repo with `make start`. Zyvor-owned labs typically use K3s + compose infra (see [`k8s/README.md`](../../k8s/README.md)).

## What you need

| Requirement | Notes |
|-------------|--------|
| Docker/Podman + compose | ~8 GB RAM free for first pull |
| Web (compose) | `http://<host>:3000` |
| API (compose) | `http://<host>:8000/health` |
| Web + API (K3s lab) | `https://<host>:30443` (self-signed) |

## 1. Install

**Trial package:** follow **GETTING-STARTED** in the tarball.  
**Source:** `make start` → web `:3000`, API `:8000`.  
**Zyvor lab:** `./scripts/deploy-remote.sh` (infra) + `./scripts/deploy-k8s.sh` (app). Seed suite products with `./scripts/seed-zyvor-suite.sh`.

## 2. Sign in

Two-step login at `/login`:

| Login | Password |
|-------|----------|
| Seeded admin (labs) | `marketing@zyvor.dev` / `Admin@321` — **change immediately** |
| SSO | When `SSO_ENABLED` + IdP configured (`realm=aurora`) |

Never publish lab host IPs in customer-facing docs — use `localhost` or your `<host>` placeholder.

## 3. First useful workflow

1. Open **GTM workspace** (`/dashboard`) → create/onboard a product (website or docs URL).
2. **Add a source** → **Ingest** — wait until status is **completed** (workers must be up).
3. Open **Full Forge** (`/products/:id`) or **Executive Brief**.
4. Run one agent action (Q&A / Strategy / Outreach) → **Approve** → **Publish** when ready.
5. **Pipeline** (`/products/:id/pipeline`) for CRM opportunities; outreach drafts include a 3-step mail follow-up sequence.

## Next steps

- [Using the Dashboard](using-the-dashboard.md)
- [Admin basics](admin-basics.md)
- [Common workflows](workflows.md)
- [SSO / OIDC](../sso-oidc.md)
- [Licensing](../LICENSING.md)
