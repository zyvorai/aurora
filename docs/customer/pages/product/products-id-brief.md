# Executive Brief

## Purpose

Executive Brief — KPIs / GTM readiness without LLM on load.

## When to use it

- Operate **Executive Brief** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/products/:id/brief`
- Nav: **Product → Executive Brief**

## Notes

- Replace `:id` with your product id from `/dashboard`.

## Operate from the console (UX)

1. Product → Brief (approver/viewer default).
2. Read KPIs / GTM readiness.
3. Open Forge if unprovisioned.
4. **Empty / fail:** Unprovisioned → open Forge ingest first.
5. **Success:** Brief KPIs populated.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Full Forge](products-id.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
