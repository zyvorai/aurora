# Admin Basics (Aurora)

## Ports

| Port | Service |
|------|---------|
| **3000** | Web UI |
| **8000** | API (`/health`, `/docs`) |
| **8180** | Optional Keycloak (source compose) |
| **30443** | Optional k3s TLS entrypoint |

Use `http://<host>:3000` — never hardcode lab IPs in customer docs.

## Auth

- Email/password (seeded lab admin — rotate immediately; disable with `SEED_DEFAULT_ADMIN=false`)
- SSO via `SSO_ENABLED` + OIDC (BYO IdP for most deploys)
- First user is `admin`; `editor` / `approver` / `viewer` change default landing (Danger Zone remains admin-only)

## Install sketch

**Trial:** download release tarball → load images → `docker-compose.infra.trial.yml` then `docker-compose.trial.yml`.  
**Source:** `make start`.

Verify: `curl -s http://127.0.0.1:8000/health`

## Related

- [Getting Started](getting-started.md)
