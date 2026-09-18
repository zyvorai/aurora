# Getting Started with Aurora

Shortest path from install → signed-in product → first useful result.

Clone this repo and run `make start`. Zyvor-owned labs typically use K3s + compose infra (see [`k8s/README.md`](../../k8s/README.md)).

## What you need

| Requirement | Notes |
|-------------|--------|
| Docker/Podman + compose | ~8 GB RAM free for first pull |
| Web (compose) | `http://<host>:3000` |
| API (compose) | `http://<host>:8000/health` |
| Web + API (K3s lab) | `https://<host>:30443` (self-signed) |

## 1. Install

**Source:** `make start` → web `:3000`, API `:8000`.  
**Zyvor lab:** `./scripts/deploy-remote.sh` (infra) + `./scripts/deploy-k8s.sh` (app). Seed suite products with `./scripts/seed-zyvor-suite.sh` (idempotent — skips existing products, sources, opportunities, and outreach campaigns).

## 2. Sign in

Two-step login at `/login`:

| Login | Password |
|-------|----------|
| Seeded admin (labs) | `marketing@zyvor.dev` / `Admin@321` — **change immediately** |
| SSO | When `SSO_ENABLED` + IdP configured (`realm=aurora`) |

Never publish lab host IPs in customer-facing docs — use `localhost` or your `<host>` placeholder.

## 3. First useful workflow

1. Open **GTM workspace** (`/dashboard`) → **+ Onboard product** (modal opens centered in the viewport).
2. **Add a source** → **Ingest** — wait until status is **completed** (workers must be up).
3. Open **Workspace** (`/products/:id`) → **Build profile** (runs async; pipeline rail updates when done).
4. Run **Generate strategy** or **Q&A** to verify grounded answers cite your docs.
5. **Approve** → **Publish** when ready; **Pipeline** (`/products/:id/pipeline`) for CRM opportunities.

**Dashboard tips:** With 6+ products, use **Search** and **All / Ready / Setup** filters. Product cards show compact source links (e.g. `zyvor.dev/aurora`), not raw URLs.

## Next steps

- [Using the Dashboard](using-the-dashboard.md)
- [Admin basics](admin-basics.md)
- [Common workflows](workflows.md)
- [SSO / OIDC](../sso-oidc.md)
- [Licensing](../LICENSING.md)
