# Aurora — Customer Documentation

**Aurora** turns your technical product into an AI-powered salesperson — discover product knowledge, run GTM agents, and publish with approvals.

| You want to… | Open |
|--------------|------|
| Install and log in | [Getting Started](getting-started.md) |
| Learn the shell | [Using the Dashboard](using-the-dashboard.md) |
| Follow a page, step by step | [Page-by-page guides](pages/README.md) |
| Look up any screen by route | [Complete page index](PAGE_INDEX.md) |
| Deploy, auth, ports | [Admin basics](admin-basics.md) |
| Multi-page jobs | [Common workflows](workflows.md) |

## Printable PDFs

```bash
set -a; source scripts/customer-docs/product.env; set +a
node scripts/customer-docs/build-customer-pdfs.mjs
```

Output lands in [`pdf/`](pdf/).

## Product at a glance

```text
  Web UI   →  http://<host>:3000
  API      →  http://<host>:8000  (/health, /docs)
  Agents   →  Marketing / Sales / Solution (Full Forge)
```
