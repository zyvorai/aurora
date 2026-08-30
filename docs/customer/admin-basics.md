# Admin Basics (Aurora)

## Ports

| Port | Service |
|------|---------|
| **3000** | Web UI (compose / NodePort break-glass) |
| **8000** | API (compose / NodePort break-glass) |
| **8180** | Optional Keycloak (source compose), realm **`aurora`** |
| **30443** | K3s HTTPS entrypoint (`aurora-tls-proxy`) — preferred for labs |

Use `https://<host>:30443` when the K3s stack is deployed; otherwise `http://<host>:3000`. Never hardcode lab IPs in customer docs.

## Auth

- Email/password — **2-step** UI at `/login` (seeded lab admin — rotate immediately; disable with `SEED_DEFAULT_ADMIN=false`)
- SSO via `SSO_ENABLED` + OIDC (realm **`aurora`**, never legacy `emissary`)
- Zyvor-owned labs: `AURORA_LICENSE_ENFORCE=false` (see [LICENSING.md](../LICENSING.md))

## Install sketch

**Trial:** download release tarball → load images → `docker-compose.infra.trial.yml` then `docker-compose.trial.yml`.  
**Source:** `make start`.  
**Lab K3s:** `deploy-remote.sh` + `deploy-k8s.sh`; seed zyvor.dev products with `seed-zyvor-suite.sh`.

Verify: `curl -sk https://127.0.0.1:30443/health` (or `http://127.0.0.1:8000/health` on compose).

## Related

- [Getting Started](getting-started.md)
