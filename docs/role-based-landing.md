# Role-Based Default Landing

The web app sends each user to the **persona view that matches their RBAC role**, instead of always opening the dashboard or Full Forge. This follows the persona-first Forge plan in [multi-agent-composition-plan.md §9](./multi-agent-composition-plan.md).

---

## Why

Different GTM personas care about different surfaces:

| Persona | Primary need | LLM at page load? |
|---------|--------------|-------------------|
| Executive / Board | KPIs, readiness, risks | **No** (Brief) |
| Sales | Leads, outreach, pipeline | **No** (actions trigger LLM) |
| Marketing | Campaigns, content, ICP | **No** |
| Partner | Product facts, templates | **No** |
| Admin / RevOps | Ingest, agents, all tabs | On demand (Full Forge) |

Role-based landing removes extra clicks after sign-in and keeps the dashboard CTAs aligned with how each role works.

---

## RBAC role → default route

The API issues four roles (`admin`, `editor`, `approver`, `viewer`). The frontend maps them to default product routes:

| API role | Default persona | Route |
|----------|-----------------|-------|
| `admin` | Full Forge | `/products/{id}` |
| `approver` | Executive Brief | `/products/{id}/brief` |
| `viewer` | Executive Brief | `/products/{id}/brief` |
| `editor` | Sales Workspace | `/products/{id}/sales` |

Mapping is defined in [`apps/web/src/lib/role-routing.ts`](../apps/web/src/lib/role-routing.ts) as `ROLE_DEFAULT_PERSONA`.

All persona views remain reachable from the product sidebar (Brief, Sales, Pipeline, Marketing, Partner, Full Forge). Role-based landing only affects **defaults**, not access control.

---

## User flows

### Sign in / register

1. Auth returns `access_token`, `tenant_id`, and **`role`**.
2. The client stores all three in `localStorage` (`token`, `tenant_id`, `role`).
3. Post-login redirect:
   - **Exactly one product** → role default for that product (e.g. admin → Full Forge).
   - **Zero or multiple products** → `/dashboard`.

**Sign-up (`apps/web/src/app/login/page.tsx`) is URL-first and skips this redirect logic
on the happy path**: step 1 collects the product's URL, step 2 the account. On submit,
after `auth.register` the client immediately calls `products.create` with the step-1 URL,
`products.addSource`, and `products.ingest`, then routes straight to that new product's
Full Forge (`/products/{id}`) — real ingest already running. `resolvePostLoginRoute()` is
only used as a fallback if product creation fails (lands on `/dashboard` instead). Plain
sign-in (the masthead toggle, or SSO) still goes through `resolvePostLoginRoute()`
exactly as before.

### Dashboard

- Hero subtitle describes the user’s default workspace (e.g. “Your default workspace is Sales Workspace…”).
- Each product card’s **primary button** opens the role default; **secondary** opens Brief or Full Forge as a fallback.
- **Onboard product** → after create, redirect to role default for the new product.

### Product shell

- `/products/[id]/*` routes render inside `ProductConsoleShell` (left rail + top tab
  bar), not the site-wide `AppShell` navbar used elsewhere. The top tab bar is the same
  role-driven workspace list as before (Forge/Pipeline/Sales/Marketing/Partners/Brief).
- Full Forge's header badge is chain-derived (e.g. "needs sources", "ingesting",
  "ready" — `chainStatusLabel()` in `apps/web/src/lib/chain.ts`), not a static label.

---

## Backend roles & permissions

Roles are assigned at registration (first user is `admin`) and enforced on the API:

| Role | Permissions |
|------|-------------|
| `admin` | read, write, approve, publish, manage_users, manage_billing |
| `editor` | read, write |
| `approver` | read, write, approve |
| `viewer` | read |

See [`apps/api/gtm_api/auth.py`](../apps/api/gtm_api/auth.py) (`ROLE_PERMISSIONS`).

The frontend mostly **does not** gate routes by role — it only changes default navigation, relying on the API to enforce permissions (e.g. `viewer` cannot call write-only routes). The one exception is `/dashboard/admin/danger` (tenant data export/purge), which has an inline `role !== 'admin'` guard as defense-in-depth alongside the backend's `manage_tenant` permission check — a deliberate one-off for a single destructive-action page, not a general route-guard framework.

---

## Testing different roles

### 1. Register (admin)

New tenants get an `admin` user. With one product, sign-in lands on **Full Forge**.

### 2. Change role in the database

```sql
UPDATE users SET role = 'editor' WHERE email = 'you@example.com';
-- or: approver | viewer
```

Sign out, sign in again (or clear `localStorage` and re-login) so `role` is refreshed.

### 3. Verify behavior

| Role | After login (1 product) | Dashboard primary CTA |
|------|------------------------|------------------------|
| admin | `/products/{id}` | Open Full Forge |
| editor | `/products/{id}/sales` | Open Sales Workspace |
| approver / viewer | `/products/{id}/brief` | Open Executive Brief |

---

## Implementation reference

| File | Purpose |
|------|---------|
| [`apps/web/src/lib/role-routing.ts`](../apps/web/src/lib/role-routing.ts) | Role → persona map, post-login resolver, dashboard CTAs |
| [`apps/web/src/app/page.tsx`](../apps/web/src/app/page.tsx) | Login/register → `resolvePostLoginRoute()` |
| [`apps/web/src/app/dashboard/page.tsx`](../apps/web/src/app/dashboard/page.tsx) | Role-aware product card buttons |
| [`apps/web/src/hooks/useAuth.ts`](../apps/web/src/hooks/useAuth.ts) | Exposes `role` from `localStorage` |
| [`apps/web/src/components/layout/AppHeader.tsx`](../apps/web/src/components/layout/AppHeader.tsx) | Default workspace badge |
| [`apps/web/src/components/layout/ProductShell.tsx`](../apps/web/src/components/layout/ProductShell.tsx) | Role-aware breadcrumb home link |
| [`apps/web/src/app/dashboard/admin/danger/page.tsx`](../apps/web/src/app/dashboard/admin/danger/page.tsx) | Admin-only page with an inline `role !== 'admin'` guard |

### Key functions

```typescript
// Default product URL for a role
defaultProductRoute(productId, role)

// After auth — single product deep link or dashboard
resolvePostLoginRoute(role)

// Dashboard card buttons
dashboardActionsForRole(role)
```

---

## Future extensions (not implemented)

- **User-selectable persona** — e.g. marketing vs sales preference for `editor` users (would need a `preferred_persona` field on `User`).
- **General route-guard framework** — a single inline guard exists for the admin danger-zone page (see above); hiding sidebar items or blocking other pages by role is still not implemented.
- **Org-level defaults** — tenant setting to override `ROLE_DEFAULT_PERSONA` for all users.

---

## Related docs

- [multi-agent-composition-plan.md §9](./multi-agent-composition-plan.md) — original persona-first UI plan
- [dev-guide.md](./dev-guide.md) — local setup and troubleshooting
- [gtm-platform-phases.md](./gtm-platform-phases.md) — platform phase status
