# Customer portal login

## Purpose

Customer portal login — Aurora surface at `/portal/customer/login`.

## When to use it

- Operate **Customer portal login** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/portal/customer/login`
- Nav: **Portals → Customer portal login**

## Operate from the console (UX)

1. `/portal/customer/login`.
2. Sign in.
3. Request access → signup.
4. **Empty / fail:** Pending approval.
5. **Success:** Portal home.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Customer portal](portal-customer.md)
- [Customer portal signup](portal-customer-signup.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
