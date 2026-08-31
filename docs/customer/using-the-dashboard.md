# Using the Dashboard

Aurora’s web shell is persona-aware after login.

## Surfaces

| Surface | Purpose |
|---------|---------|
| **GTM workspace** `/dashboard` | Products, search/filters, onboarding, persona entry |
| **Workspace** `/products/:id` | Sources, ingest, pipeline stages, agent tabs, approve/publish |
| **Executive Brief** | Read-only KPIs (approver/viewer default) |
| **Sales Action / Pipeline** | Leads and opportunities (editor default) |
| **Admin** | Portal accounts, tickets, workflow stages, Danger Zone |
| **External portals** | Customer / reseller / salesperson |

## Dashboard UX (2026)

- **+ Onboard product** opens a viewport-centered modal (portaled to `document.body`).
- **Search** appears when you have 6+ products; filter tabs: All / Ready / Setup.
- Subtitle: onboarding and ingest guidance (not a generic “workspace” label).
- Already signed in? Visiting `/login` redirects to your role default landing.

## Browse vs act

Brief and audit are safe. Ingest, agent runs, approve/publish, and Danger Zone purge mutate tenant data — confirm role and impact first.

## Related

- [Getting Started](getting-started.md)
- [Common workflows](workflows.md)
