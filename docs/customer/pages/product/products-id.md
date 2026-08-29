# Full Forge

## Purpose

Full Forge — ingest sources, run GTM chain stages, agent tabs, approve and publish.

## When to use it

- Operate **Full Forge** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/products/:id`
- Nav: **Product → Full Forge**

## Notes

- Replace `:id` with your product id from `/dashboard`.

## Operate from the console (UX)

1. Open product → Full Forge (`?tab=`).
2. Add source + Ingest.
3. Run chain stages.
4. Agent tabs (Q&A/Strategy/Content/Sales/Outreach/Architect/Proposal/Publish).
5. Approve → Publish.
6. **Empty / fail:** Source not completed → wait for workers.
7. **Success:** Source completed; brief grounded; publish succeeds.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Executive Brief](products-id-brief.md)
- [Sales Action](products-id-sales.md)
- [Your GTM workspace](../workspace/dashboard.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
