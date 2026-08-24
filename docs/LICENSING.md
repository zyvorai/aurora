# Licensing

Aurora ships with a **keyless 30-day trial**. The trial clock starts the first
time the API successfully writes to Postgres (`license_state.first_seen_at`) and
survives pod restarts. Only a fresh database resets it.

## After the trial

Product API routes return **HTTP 402** until a valid license key is configured.
Health checks, `/api/v1/license/status`, and sign-in/sign-up stay reachable so
operators can still apply a key.

**Contact:** [sales@zyvor.dev](mailto:sales@zyvor.dev)

## Apply a key

| Path | How |
|------|-----|
| Env | `AURORA_LICENSE_KEY=<key>` then restart api/workers |
| Helm | `--set license.key=<key>` or `license.existingSecret` with data key `license.key` |
| Compose | set `AURORA_LICENSE_KEY` in `.env` |

Status:

```bash
curl -s http://localhost:8000/api/v1/license/status
```

## Sales: minting keys

Internal only (do **not** ship in customer packages):

```bash
python3 scripts/gen-trial-key.py --who "Acme Corp" --days 365
```

Keys are HMAC-signed (`p=aurora`, issue/expiry dates, licensee). Expired or
tampered keys are rejected.

## Local development

```bash
AURORA_LICENSE_ENFORCE=false   # skip middleware (tests / local hack)
```

Default for production images is `AURORA_LICENSE_ENFORCE=true`.

## Customer distribution

Binary packages (images + Helm + compose, **no source**) are published to the
public GitHub repo [`hypersdk/aurora`](https://github.com/hypersdk/aurora):

| | |
|---|---|
| Current trial | [v0.1.0](https://github.com/hypersdk/aurora/releases/tag/v0.1.0) |
| Download | [aurora-0.1.0.tar.gz](https://github.com/hypersdk/aurora/releases/download/v0.1.0/aurora-0.1.0.tar.gz) |

```bash
./scripts/build-customer-package.sh 0.1.0
./scripts/publish-trial-release.sh 0.1.0
```

`hypersdk-web` / zyvor.dev does **not** host or proxy Aurora — see that site’s README
for the same download links (marketing/docs only).