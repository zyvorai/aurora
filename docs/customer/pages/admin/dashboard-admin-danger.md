# Danger Zone

## Purpose

Danger Zone — Aurora surface at `/dashboard/admin/danger`.

## When to use it

- Operate **Danger Zone** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/dashboard/admin/danger`
- Nav: **Admin → Danger Zone**

## Operate from the console (UX)

1. Admin → Danger Zone.
2. Export tenant data.
3. Purge ingested data (typed confirm).
4. **Empty / fail:** Admin only.
5. **Success:** Export downloads / purge confirmed.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Your GTM workspace](../workspace/dashboard.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
