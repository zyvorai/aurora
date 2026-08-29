# Pipeline

## Purpose

Pipeline — Aurora surface at `/products/:id/pipeline`.

## When to use it

- Operate **Pipeline** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/products/:id/pipeline`
- Nav: **Product → Pipeline**

## Notes

- Replace `:id` with your product id from `/dashboard`.

## Operate from the console (UX)

1. Product → Pipeline.
2. Create opportunity.
3. Drag stage.
4. Run technical eval.
5. **Empty / fail:** Empty pipeline → create opportunity.
6. **Success:** Stage moves persist.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Sales Action](products-id-sales.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
