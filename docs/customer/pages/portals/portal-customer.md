# Customer portal

## Purpose

Customer portal — Aurora surface at `/portal/customer`.

## When to use it

- Operate **Customer portal** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/portal/customer`
- Nav: **Portals → Customer portal**

## Operate from the console (UX)

1. `/portal/customer`.
2. Open support ticket.
3. Edit profile.
4. **Empty / fail:** Not approved → wait.
5. **Success:** Ticket created.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Support Tickets](../admin/dashboard-admin-tickets.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
