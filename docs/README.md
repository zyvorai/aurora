# Docs index

## Operator / developer docs

| Doc | Purpose |
|-----|---------|
| [`dev-guide.md`](dev-guide.md) | Full local dev guide — prerequisites, `make start`/`stop`, Makefile reference, infra services, env config, troubleshooting. |
| [`sso-oidc.md`](sso-oidc.md) | SSO/OIDC + bundled Keycloak setup, demo account credentials, BYO IdP. |
| [`LICENSING.md`](LICENSING.md) | AGPL-3.0 vs. commercial ACL — what's free, what needs a license. |
| [`source-management.md`](source-management.md) | Supported knowledge-source types (website, docs, CSV, YouTube, GitHub, OpenAPI, …) and ingestion behavior. |
| [`role-based-landing.md`](role-based-landing.md) | Persona-based post-login routing (exec/sales/marketing land on different views). |
| [`ollama-llm-integration.md`](ollama-llm-integration.md) | Dual-provider LLM architecture (Ollama vs. OpenAI-compatible), per-agent model routing, testing. |
| [`test-cases.md`](test-cases.md) | Canonical test inventory (223 tests) mapped to test files. |

## Internal engineering / planning docs

Not user-facing — implementation status and design rationale for
contributors working on the platform itself.

| Doc | Purpose |
|-----|---------|
| [`gtm-platform-phases.md`](gtm-platform-phases.md) | 12-phase implementation/status tracker with acceptance criteria and test matrix. |
| [`multi-agent-composition-plan.md`](multi-agent-composition-plan.md) | Design plan for evolving monolithic agents into specialized, supervised agents. |

## Customer-facing docs

A separate, more polished doc set aimed at end users/admins rather than
contributors — see **[`customer/README.md`](customer/README.md)**, which
also covers the getting-started guide, dashboard guide, page-by-page guides,
and the printable PDF manuals.
