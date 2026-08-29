# Marketing Studio

## Purpose

Marketing Studio — Aurora surface at `/products/:id/marketing`.

## When to use it

- Operate **Marketing Studio** when your job matches this page
- Admin lands on Full Forge by default; editors on Sales; approvers/viewers on Brief
- Confirm auth and that workers are up if ingest never completes

## How to get there

- Route: `/products/:id/marketing`
- Nav: **Product → Marketing Studio**

## Notes

- Replace `:id` with your product id from `/dashboard`.

## Operate from the console (UX)

1. Product → Marketing.
2. Run Outbound Sprint.
3. Campaigns.
4. Strategy/Content deep-links into Forge.
5. **Empty / fail:** Needs ingested product.
6. **Success:** Sprint/campaign created.

Use `http://<host>:3000` for the web UI and `http://<host>:8000/health` for the API. Never publish lab IPs in customer docs.

## Related pages

- [Full Forge](products-id.md)
- [Getting Started](../../getting-started.md)
- [Page index](../../PAGE_INDEX.md)
