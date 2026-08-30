# Licensing

Aurora evaluation uses a **signed trial token** (Ed25519 / EdDSA JWT) — the same
design as Veyron. There is **no** server-side `first_seen_at` clock: expiry lives
inside the token. Deleting the database cannot extend a trial.

The package embeds only the **public** key. Zyvor sales holds the private key and
issues `trial.token` files (or `AURORA_TRIAL_TOKEN` / `AURORA_LICENSE_KEY` env
values).

## How the trial works

- Customer packages ship a `trial.token` (typically 30 days) next to the install,
  or operators set `AURORA_TRIAL_TOKEN` / `AURORA_LICENSE_KEY`.
- While the token is valid, every feature works — nothing is crippled.
- After `exp`, product API routes return **HTTP 402** until a renewed signed
  token is installed. Health checks, `/api/v1/license/status`, and sign-in stay
  reachable.

**Contact:** [sales@zyvor.dev](mailto:sales@zyvor.dev)

## Apply a token

| Path | How |
|------|-----|
| File | Place `trial.token` at `/app/trial.token` (container) or CWD |
| Env | `AURORA_TRIAL_TOKEN=<jwt>` or `AURORA_LICENSE_KEY=<jwt>` then restart |
| File path | `AURORA_TRIAL_TOKEN_FILE=/path/to/trial.token` |
| Helm | `--set license.key=<jwt>` or `license.existingSecret` with data key `license.key` |

Status:

```bash
curl -s http://localhost:8000/api/v1/license/status
```

## Sales: minting tokens (private repo only)

Do **not** ship `scripts/trial-tool.py` or `secrets/` in customer packages.

```bash
python3 scripts/trial-tool.py keygen          # once; paste public key into licensing.py
python3 scripts/trial-tool.py issue --who "Acme Corp" --days 30 -o trial.token
```

Product claim: `aurora-trial` (tokens for Veyron / Ragnarok / Argus will not unlock Aurora).

## Local development & Zyvor-owned labs

```bash
AURORA_LICENSE_ENFORCE=false   # no trial gate; /license/status reports licensed=true
```

`.env.prod.example` defaults to **`false`** for Zyvor-owned / lab installs. Customer
evaluation packages should set `AURORA_LICENSE_ENFORCE=true` and ship a signed
`trial.token`.

## Customer distribution

Binary packages (images + Helm + compose, **no source**) are published to the
public GitHub repo [`hypersdk/aurora`](https://github.com/hypersdk/aurora).
Older HMAC / keyless-DB trial releases were removed; new packages must include a
signed `trial.token`.

```bash
./scripts/build-customer-package.sh 0.1.1
# issue token into the package root before publish:
python3 scripts/trial-tool.py issue --who "Aurora evaluation" --days 30 -o dist/trial.token
./scripts/publish-trial-release.sh 0.1.1
```

Packages include `GETTING-STARTED.md`, `INSTALL.md`, `SSO.md`, and `AFTER-TRIAL.md`.
Operator SSO guide: [`docs/sso-oidc.md`](sso-oidc.md).
