# Salesperson portal login

## Purpose

Salesperson portal login — Aurora surface at `/portal/salesperson/login`.

## When to use it

- Operate **Salesperson portal login** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/portal/salesperson/login`
- Nav: **Portals → Salesperson portal login**

## Operate from the console (UX)

1. `/portal/salesperson/login`.
2. Sign in.
3. Become a sales rep.
4. **Empty / fail:** Pending approval.
5. **Success:** Portal home.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Salesperson portal](portal-salesperson.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
