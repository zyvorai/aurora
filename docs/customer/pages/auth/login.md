# Sign in

## Purpose

Sign in / Create workspace — email/password or SSO; URL-first signup.

## When to use it

- Operate **Sign in** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/login`
- Nav: **Auth → Sign in**

## Operate from the console (UX)

1. Open `/login`.
2. Sign in email/password.
3. SSO when enabled.
4. URL-first signup → create product + ingest.
5. **Empty / fail:** Auth failure → check credentials/SSO.
6. **Success:** Signed into /dashboard.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Your GTM workspace](../workspace/dashboard.md)
- [SSO callback](login-callback.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
