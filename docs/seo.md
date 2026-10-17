# SEO

Aurora scores and audits content with deterministic checks and is explicit about what is measured and what is estimated.

## What it does

| Capability | How | Measured or estimated |
|---|---|---|
| Page audit (`POST /products/{id}/seo/audit`) | Fetches a public URL (SSRF-checked on every redirect hop, 2 MB cap) and checks title, meta description, headings, canonical, robots, viewport, lang, Open Graph, alt text, JSON-LD, word count and links; returns a 0-100 score and itemised fixes | Computed from the page |
| Content score (`POST /artifacts/{id}/seo/score`) | Keyword in H1/title and first 100 words, density, heading structure, meta lengths, length, readability (Flesch), internal links; stores the block in `Artifact.metadata_["seo"]` with meta title/description and Article JSON-LD | Computed from the draft |
| Keyword research (`POST /products/{id}/seo/keywords`) | Provider chosen by `SEO_PROVIDER` | See below |
| SEO article type | Content type `seo_article` (and `blog`, `technical_deep_dive`) generates the draft and stores the SEO block on the artifact | Computed |
| WordPress publishing | Channel `wordpress`: title/excerpt/JSON-LD from the SEO block; only reachable through the approved-artifact, hash-bound publish gate | n/a |

## Keyword providers

- `grounded` (default): terms mined from your own product knowledge base. Every row is labelled `source: "estimate"`; there is no volume or difficulty.
- `dataforseo`: measured monthly volume and difficulty. Needs `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`.
- `search_console`: your own queries, clicks, impressions and average position. Needs `GSC_ACCESS_TOKEN` and `GSC_SITE_URL`, read-only scope.

If a provider is selected but not configured, Aurora falls back to `grounded` and says so in the response (`provider`, `measured`).
`GET /seo/providers` reports what is configured.

## Approval

The SEO block is published with the content. Recomputing it on an **approved** artifact returns that artifact to draft, so a
reviewer approves the meta text and JSON-LD together with the body.

## Status

Unit-tested against fixtures and mocked HTTP: audit, content score, providers, WordPress adapter, redirect/SSRF handling.
Not yet verified against live DataForSEO, Google Search Console or a WordPress site (needs operator credentials). The Search Console
OAuth consent flow is not built: supply an access token from your own OAuth app.
