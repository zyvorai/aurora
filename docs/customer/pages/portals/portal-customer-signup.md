# Customer portal signup

## Purpose

Customer portal signup — Aurora surface at `/portal/customer/signup`.

## When to use it

- Operate **Customer portal signup** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/portal/customer/signup`
- Nav: **Portals → Customer portal signup**

## Operate from the console (UX)

1. `/portal/customer/signup`.
2. Submit signup request.
3. **Empty / fail:** —.
4. **Success:** Request pending admin approval.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Customer portal login](portal-customer-login.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
