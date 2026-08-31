# Workspace

## Purpose

Workspace — ingest sources, run the GTM pipeline chain, agent tabs, approve and publish.

## When to use it

- Add sources, ingest, build product profile, run strategy/outreach agents
- Monitor async work in the **Run log** dock (right rail on wide screens)

## How to get there

- Route: `/products/:id` (optional `?tab=strategy|query|content|…`)
- Nav: **Product → Workspace**

## Operate from the console (UX)

1. **Sources** panel — add URL/file sources; **Ingest all** or per-row **Ingest**.
2. **Next up** card — drives the pipeline (ingest → **Build profile** → strategy → …).
3. **Build profile** runs async; pipeline rail updates when complete (no full-page reload).
4. **Run log** — shows active jobs; only the latest result per workflow (old failures hidden after success). Errors are user-safe (no provider org IDs).
5. Agent tabs: Q&A, Content, Sales chat, Architect, Analytics, Strategy, Outreach, Proposal, Publish.
6. Source links display as `zyvor.dev/path` (clickable), not raw IPs.

Use `https://<host>:30443` for lab TLS. Never publish lab IPs in customer docs.

## Related pages

- [Executive Brief](products-id-brief.md)
- [Sales Action](products-id-sales.md)
- [Your GTM workspace](../workspace/dashboard.md)
- [Source management](../../../source-management.md)
