# Customer portal signup

## Purpose

Customer portal signup — request access to a vendor’s Aurora tenant.

## When to use it

- End customers invited by a vendor (not self-service without an invite)
- Admin approves requests in **Portal Accounts**

## How to get there

- Route: `/portal/customer/signup?tenant=<slug>&product=<uuid>`
- Nav: **Portals → Customer portal** → Request access (with invite link)

## Operate from the console (UX)

1. Open the **invite link** from your vendor (includes `tenant` and `product` query params).
2. Without an invite, the page explains you need a link — no raw Product ID field.
3. Fill company name, your name, work email, password → **Request access**.
4. **Success:** Pending admin approval; sign in at `/portal/customer/login` once approved.

Use `https://<host>:30443` for lab TLS or `http://<host>:3000` for compose. Never publish lab IPs in customer docs.

## Related pages

- [Customer portal login](portal-customer-login.md)
- [Portal accounts (admin)](../admin/dashboard-admin-portal-accounts.md)
- [Getting Started](../../getting-started.md)
