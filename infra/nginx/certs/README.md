# TLS certificate for aurora.zyvor.dev

This directory is gitignored — never commit real key material here.

## What to request from the CA (BigRock / SSL2BUY)

A certificate whose Subject Alternative Name (SAN) list includes:

```
aurora.zyvor.dev
```

(The existing `zyvor.dev.crt` in `../../hypersdk-web/bigrock-ssl/` only covers
`zyvor.dev` and `www.zyvor.dev` — it will NOT validate for this subdomain.
Either request a SAN cert for `aurora.zyvor.dev` specifically, or a true
`*.zyvor.dev` wildcard if you want to reuse it across future subdomains too.)

Generate a CSR for the request, e.g.:

```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout aurora.zyvor.dev.key \
  -out aurora.zyvor.dev.csr \
  -subj "/CN=aurora.zyvor.dev"
```

Submit `aurora.zyvor.dev.csr` to the CA. Keep `aurora.zyvor.dev.key`
private — it stays on this server, never in git, never sent anywhere.

## Where the resulting files go

Once the CA issues the certificate:

| File | Purpose |
|------|---------|
| `aurora.zyvor.dev.crt` | The issued certificate (+ intermediate chain, fullchain style) |
| `aurora.zyvor.dev.key` | The private key generated above (do not regenerate — must match the CSR that was submitted) |

Place both files in this directory on the **remote host**
(`~/.deployments/aurora/infra/nginx/certs/`), then restart nginx:

```bash
ssh sus@175.110.122.71 'cd ~/.deployments/aurora && sudo docker compose --project-directory . -f infra/docker-compose.yml -f docker-compose.prod.yml -f infra/nginx/docker-compose.nginx.yml restart nginx'
```

## DNS

Add an A record at your DNS provider before any of this is reachable:

```
aurora.zyvor.dev.  A  175.110.122.71
```

## After the cert is live

Set in `.env` (repo root, on the remote host) and rebuild the web image so
the browser bundle calls the same-origin API through nginx instead of a
separate host:port:

```
NEXT_PUBLIC_API_URL=https://aurora.zyvor.dev/api/v1
```
