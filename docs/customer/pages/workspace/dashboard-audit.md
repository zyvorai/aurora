# Audit Log

## Purpose

Audit Log — Aurora surface at `/dashboard/audit`.

## When to use it

- Operate **Audit Log** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/dashboard/audit`
- Nav: **Workspace → Audit Log**

## Operate from the console (UX)

1. Nav Audit.
2. Filter write/approve/publish trail.
3. **Empty / fail:** No events yet.
4. **Success:** Rows after actions.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Your GTM workspace](dashboard.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
