# SSO callback

## Purpose

SSO callback — Aurora surface at `/login/callback`.

## When to use it

- Operate **SSO callback** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/login/callback`
- Nav: **Auth → SSO callback**

## Operate from the console (UX)

1. OIDC redirect lands here.
2. Complete OIDC redirect.
3. land on dashboard.
4. **Empty / fail:** SSO misconfigured → see Admin SSO docs.
5. **Success:** Session established.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Sign in](login.md)
- [Your GTM workspace](../workspace/dashboard.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
