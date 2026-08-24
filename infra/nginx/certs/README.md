# Optional TLS certificate (compose nginx overlay)

**Not required for the current production path.** Aurora runs as an independent
product on K3s — see [`k8s/README.md`](../../../k8s/README.md) —
`https://<host>:30443` with a self-signed cert until you attach a real domain +
CA-issued certificate to the `aurora-tls` Secret.

This directory is only for the **optional** docker-compose nginx overlay
(`infra/nginx/docker-compose.nginx.yml`) when you want HTTPS on the compose stack
instead of (or in addition to) K3s. It is gitignored — never commit real key material.

`hypersdk-web` / `zyvor.dev` no longer reverse-proxies Aurora.

## What to request from the CA

A certificate whose Subject Alternative Name (SAN) list includes your public hostname,
e.g.:

```
aurora.example.com
```

Generate a CSR:

```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout aurora.example.com.key \
  -out aurora.example.com.csr \
  -subj "/CN=aurora.example.com"
```

Submit the `.csr` to the CA. Keep the `.key` private — it stays on the server, never in git.

## Where the resulting files go

| File | Purpose |
|------|---------|
| `*.crt` | Issued certificate (+ intermediate chain, fullchain style) |
| `*.key` | Private key matching the CSR |

Place both under this directory on the **remote host**
(e.g. `~/.deployments/emissary/infra/nginx/certs/` or your deploy path), then restart
nginx via the compose overlay. `deploy-remote.sh` auto-enables the overlay when matching
cert/key files exist.

## After the cert is live

Set in `.env` on the remote host and rebuild the web image so the browser bundle calls
the same-origin API through nginx:

```
NEXT_PUBLIC_API_URL=https://aurora.example.com/api/v1
```
