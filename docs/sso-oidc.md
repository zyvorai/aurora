# Aurora — SSO / OIDC (Keycloak) & demo logins

How to sign into Aurora with **email/password**, the **bundled Keycloak** demo
IdP, or **your own OIDC provider** (Auth0, Okta, Azure AD, existing Keycloak, …).

## Demo accounts (quick reference)

| Path | Username / email | Password | Notes |
|------|------------------|----------|-------|
| Email/password (always available) | `marketing@zyvor.dev` | `Admin@321` | Seeded on first boot when `SEED_DEFAULT_ADMIN=true` (default). **Change immediately** outside a throwaway lab; disable with `SEED_DEFAULT_ADMIN=false`. |
| Keycloak SSO (bundled demo IdP) | `demo` | `demo` | User in `infra/keycloak/aurora-realm.json` (`demo-sso@zyvor.dev`). Smoke-test only — not a production account. |
| Keycloak admin console | `admin` | `keycloak_admin_dev` | Dev-only bootstrap for the Keycloak container itself (`infra/docker-compose.yml`). |

Open the web UI → **Sign in** (two-step: email → **Continue** → password). For SSO, use
**Continue with SSO** (when `SSO_ENABLED=true`); for local auth, use the email/password form.

## Option A — Email/password only (default compose)

No Keycloak required. After `make start`:

1. Open the web UI.
2. Sign in as `marketing@zyvor.dev` / `Admin@321`.
3. Change that password (or recreate with a real admin) before any real use.

## Option B — Bundled Keycloak demo IdP (compose)

Aurora's `infra/docker-compose.yml` ships `keycloak` + `keycloak-db` and imports
`infra/keycloak/aurora-realm.json` (`realm=aurora`, client id `aurora`, user `demo`/`demo`).

1. **Start Keycloak** with the rest of infra (`make start` / compose up). Keycloak
   listens on **`:8180`** by default.
2. **Set a real client secret** in `infra/keycloak/aurora-realm.json` (replace
   `REPLACE_WITH_A_GENERATED_SECRET`) **before** first import, or update the
   client secret in the Keycloak admin console afterward and match it in `.env`.
3. **Enable SSO** in `.env` / `.env.prod` (see `.env.prod.example`):

   ```bash
   SSO_ENABLED=true
   SSO_ISSUER=http://<host>:8180/realms/aurora
   SSO_CLIENT_ID=aurora
   SSO_CLIENT_SECRET=<same secret as the Keycloak client>
   SSO_REDIRECT_URI=http://<host>:8000/api/v1/auth/sso/callback
   # K3s TLS entrypoint instead:
   # SSO_REDIRECT_URI=https://<host>:30443/api/v1/auth/sso/callback
   # Browser-reachable URLs — not docker-internal hostnames.
   ```

4. Ensure the Keycloak client's **Valid redirect URIs** and **Web origins**
   include your API callback and web origin (the realm JSON already lists
   localhost — add your real host / `https://<host>:30443` entrypoint).
5. Restart the API so it picks up the env vars.
6. Sign in via **SSO** with `demo` / `demo`.

`KC_HOSTNAME` in compose must match the issuer URL browsers and the API both
use (same host:port). A mismatch causes OIDC issuer validation failures.

### K3s / HTTPS entrypoint note

The standalone K3s stack (`k8s/`, `https://<host>:30443`) currently needs the
Keycloak client redirect URI updated to:

```text
https://<host>:30443/api/v1/auth/sso/callback
```

and matching `SSO_REDIRECT_URI` / `SSO_ISSUER` on the API Deployment. Until
those match, email/password login still works; SSO through the TLS NodePort
does not. See [`k8s/README.md`](../k8s/README.md).

## Option C — Bring your own OIDC provider

Any standards-compliant OIDC IdP (Auth0, Okta, Azure AD, Google Workspace IdP,
existing Keycloak, …):

```bash
SSO_ENABLED=true
SSO_ISSUER=https://login.example.com/                   # or …/realms/your-realm
SSO_CLIENT_ID=aurora
SSO_CLIENT_SECRET=<secret>
SSO_REDIRECT_URI=https://aurora.example.com/api/v1/auth/sso/callback
```

Register that exact redirect URI on the IdP. Demo Keycloak users do **not**
apply — use accounts from your IdP. The IdP user's email must already exist as
an Aurora user in the tenant (or you register/seed that email first); see the
SSO notes in [`gtm-platform-phases.md`](gtm-platform-phases.md).

## Helm

To enable SSO after install, set the `SSO_*` variables on the API (compose `.env` or Helm
`env.*` values) and point them at your IdP. Bundled Keycloak is part of the
source compose stack — bring your own IdP for most production deploys.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No SSO button | `SSO_ENABLED` unset/false | Set `SSO_ENABLED=true` and restart API |
| OIDC / issuer error | `KC_HOSTNAME` ≠ `SSO_ISSUER` host | Align Keycloak hostname and `SSO_ISSUER` |
| Redirect URI mismatch | Callback not registered on the client | Add exact `SSO_REDIRECT_URI` in Keycloak / IdP |
| SSO works on compose, not on `:30443` | Client still has old HTTP callback | Update redirect URI + `SSO_REDIRECT_URI` for HTTPS NodePort |
| `demo`/`demo` rejected | Realm not imported / wrong realm | Confirm Keycloak realm `aurora` and user exist |
| Only need a login, no IdP | — | Use `marketing@zyvor.dev` / `Admin@321` |

## Related

- Env examples: [`.env.example`](../.env.example), [`.env.prod.example`](../.env.prod.example)
- Realm import: [`infra/keycloak/aurora-realm.json`](../infra/keycloak/aurora-realm.json)
- K3s deploy notes: [`k8s/README.md`](../k8s/README.md)
- Phase / implementation notes: [`gtm-platform-phases.md`](gtm-platform-phases.md)
- Sales: [sales@zyvor.dev](mailto:sales@zyvor.dev) · [zyvor.dev/aurora](https://zyvor.dev/aurora)
