# Sign in

## Purpose

Two-step Apple-style sign-in (email → password) or create-account flow; optional SSO.

## When to use it

- Sign in to the GTM workspace
- Create a workspace from a product URL (signup)
- Use SSO when `SSO_ENABLED` is configured

## How to get there

- Route: `/login`
- Production / lab K3s: `https://<host>:30443/login`

## Operate from the console (UX)

1. Open `/login` — full-bleed white hero with **Aurora** wordmark.
2. **Sign in (2 steps):**
   1. Enter email → **Continue**
   2. Enter password → **Sign in** (chip shows email; **Edit** returns to step 1)
3. **Create account (2 steps):** product URL → account details.
4. **SSO:** “Continue with SSO” when enabled.
5. **Empty / fail:** wrong credentials → error under the field; stay on step.
6. **Success:** role-based landing (`/dashboard` or product console).

Seeded lab admin: `marketing@zyvor.dev` / `Admin@321` (change immediately outside labs).

Use `https://<host>:30443` for the TLS entrypoint (or `http://<host>:3000` for plain compose). Never hardcode lab IPs in published customer docs.

## Related pages

- [Your GTM workspace](../workspace/dashboard.md)
- [SSO callback](login-callback.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
