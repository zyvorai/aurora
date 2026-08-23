# Aurora on K3s

Deploys api/web/workers into the K3s cluster already running on the same host
as the docker-compose deployment (`./scripts/deploy-remote.sh` manages that
one; this is additive, not a replacement — both can run side by side).

```
./scripts/deploy-k8s.sh 175.110.122.71 sus
```

## Why this exists

The app previously had no way onto the internet except through a reverse
proxy in a separate repo (`hypersdk-web`, fronting `*.zyvor.dev`). Aurora is
being sold as an independent product and shouldn't depend on that — this
gives it its own standalone entry point via a K8s `NodePort` Service,
matching the pattern already used by the other products in this cluster
(`zyvor-janus-api`/`zyvor-janus-web`, etc).

## What's NOT in this cluster

Postgres, Redis, Qdrant, Neo4j, MinIO, and Ollama still run via
`infra/docker-compose.yml` on the same host — not migrated into K3s. The
Deployments here reach them over the host's own address (`175.110.122.71`)
instead of docker-compose's internal service-name DNS (`postgres`, `redis`,
...), which pods can't resolve. If you ever move those into the cluster too,
update the `env:` overrides in `deployment-api.yaml` and
`deployment-workers.yaml` accordingly.

## Ports

- `aurora-web` — NodePort 30900 → container 3000
- `aurora-api` — NodePort 30901 → container 8000

`aurora-web`'s image is built separately from docker-compose's, because
`NEXT_PUBLIC_API_URL` is baked into the Next.js bundle at build time and must
point at `aurora-api`'s NodePort. If you change `API_NODEPORT`, the web image
must be rebuilt to match — `deploy-k8s.sh` does this automatically.

## Known gap

SSO doesn't work through this NodePort yet — the Keycloak client's
registered redirect URI still points at the docker-compose deployment's
address. Email/password signup and login work fully.
