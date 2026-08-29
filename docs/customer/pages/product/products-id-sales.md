# Sales Action

## Purpose

Sales Action — discover/qualify leads and outreach.

## When to use it

- Operate **Sales Action** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/products/:id/sales`
- Nav: **Product → Sales Action**

## Notes

- Replace `:id` with your product id from `/dashboard`.

## Operate from the console (UX)

1. Product → Sales (editor default).
2. Discover leads.
3. Qualify.
4. Outreach (?tab=outreach).
5. Open Pipeline.
6. **Empty / fail:** No leads → run discover after ingest.
7. **Success:** Leads listed; outreach drafted.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Pipeline](products-id-pipeline.md)
- [Full Forge](products-id.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
