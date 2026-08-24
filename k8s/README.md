# Aurora on K3s

Deploys api/web/workers into the K3s cluster already running on the same host
as the docker-compose deployment (`./scripts/deploy-remote.sh` manages that
one; this is additive, not a replacement — both can run side by side).

```
./scripts/deploy-k8s.sh 175.110.122.71 sus
```

## Why this exists

Aurora is an independent product and no longer depends on `hypersdk-web` /
`zyvor.dev` for ingress. Marketing: [zyvor.dev/aurora](https://zyvor.dev/aurora).
This stack is the standalone app entrypoint: a K8s `NodePort` Service (TLS
proxy on 30443).

If you changed the frontend locally, **rsync `apps/web` to the remote deploy
tree before rebuilding** — `deploy-k8s.sh` alone can rebuild from a stale
remote copy and miss your UI changes.

## What's NOT in this cluster

Postgres, Redis, Qdrant, Neo4j, MinIO, and Ollama still run via
`infra/docker-compose.yml` on the same host — not migrated into K3s. The
Deployments here reach them over the host's own address (`175.110.122.71`)
instead of docker-compose's internal service-name DNS (`postgres`, `redis`,
...), which pods can't resolve. If you ever move those into the cluster too,
update the `env:` overrides in `deployment-api.yaml` and
`deployment-workers.yaml` accordingly.

## Ports

- **`https://<host>:30443`** — the real entrypoint. TLS-terminating nginx
  (`aurora-tls-proxy`, self-signed cert — see below) reverse-proxying
  `/api/*` + `/health` to `aurora-api`, everything else to `aurora-web`, all
  same-origin so the web client's own fetches never hit mixed-content
  blocking.
- `aurora-web` — NodePort 30900 → container 3000 (plain HTTP, direct)
- `aurora-api` — NodePort 30901 → container 8000 (plain HTTP, direct)

`aurora-web`'s image is built separately from docker-compose's, because
`NEXT_PUBLIC_API_URL` is baked into the Next.js bundle at build time and must
point at the HTTPS entrypoint above (not the plain-HTTP API NodePort — that
would get mixed-content-blocked once the page itself is served over HTTPS).
If you change `TLS_NODEPORT`, the web image must be rebuilt to match —
`deploy-k8s.sh` does this automatically.

## TLS

No CA issues a trusted certificate for a bare IP address — real HTTPS needs
a domain pointed at this host first. Until then, `deploy-k8s.sh` generates a
self-signed cert (CN/SAN = the host IP) on first run and stores it as the
`aurora-tls` k8s Secret; it won't regenerate it on subsequent runs. Browsers
will show a trust warning ("Advanced" → "Proceed") until this moves to a
real domain + CA-issued (or Let's Encrypt) cert — at that point, swap
`aurora-tls`'s contents and drop the self-signed generation step.

## Known gap

SSO through the K3s HTTPS entrypoint needs the Keycloak (or IdP) client redirect
URI and the API's `SSO_REDIRECT_URI` updated to:

```text
https://<host>:30443/api/v1/auth/sso/callback
```

until those match the TLS NodePort, email/password signup and login work fully
(`marketing@zyvor.dev` / `Admin@321`). Demo Keycloak user when SSO is wired:
`demo` / `demo`. Full guide: [`docs/sso-oidc.md`](../docs/sso-oidc.md).
