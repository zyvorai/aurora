# GTM Platform — Test Case Document

Canonical inventory of automated tests for the API backend (`apps/api/tests/`).

**Last verified:** 60 tests passing  
**Run command:** `make test` or `cd apps/api && .venv/bin/python -m pytest tests/ -v`

---

## 1. Overview

| Metric | Value |
|--------|-------|
| Total test cases | 60 |
| Test files | 9 (+ `conftest.py` shared fixtures) |
| Unit tests | 47 |
| Integration tests | 13 |
| External services required | **None** (Ollama, Postgres, Qdrant, Neo4j are mocked or not invoked) |
| Typical runtime | ~2 seconds |

Tests are grouped by platform concern: authentication, ingestion safety, RAG grounding, LLM provider wiring, multi-agent routing, and HTTP health/error handling.

---

## 2. How to run

```bash
# From repo root (uses apps/api/.venv)
make test

# Verbose, single file, or single case
cd apps/api
.venv/bin/python -m pytest tests/ -v
.venv/bin/python -m pytest tests/test_crawler.py -v
.venv/bin/python -m pytest tests/test_llm_integration.py::TestLLMIntegration::test_ollama_embed_query_native_api -v
```

**Prerequisites:** Python 3.12+ venv at `apps/api/.venv` with dev dependencies installed (`make setup` or `pip install -e ".[dev]"` from `apps/api`).

**Configuration:** `apps/api/pytest.ini` sets `asyncio_mode = auto` and `testpaths = tests`.

---

## 3. Why tests pass without live services

| Technique | Used for |
|-----------|----------|
| Pure function tests | Auth hashing, chunking, slugify, supervisor routing, enterprise plan flags |
| `monkeypatch` env vars | Switching `LLM_PROVIDER`, `OPENAI_API_KEY`, per-agent model overrides |
| `unittest.mock.patch` on `httpx.AsyncClient` | Ollama `/api/tags` and `/api/embed` responses |
| `patch("gtm_api.main.check_database")` / `check_llm_health` | `/health` without Postgres or Ollama |
| `patch("socket.getaddrinfo")` | Crawler SSRF tests without DNS/network |
| `TestClient(app)` | FastAPI HTTP layer in-process |

**Not covered yet:** end-to-end agent runs, real DB CRUD, Qdrant vector search, worker job processing. See [Section 8 — Gaps & roadmap](#8-gaps--roadmap).

---

## 4. Shared fixtures

| Fixture | File | Purpose |
|---------|------|---------|
| `clear_settings_cache` (autouse) | `tests/conftest.py` | Clears `get_settings()` LRU cache before/after each test so env `monkeypatch` values are isolated |

---

## 5. Test case inventory

### 5.1 Authentication & identity (`test_api.py`, `test_auth_rbac.py`)

| ID | Test name | Type | Preconditions | Steps | Expected result |
|----|-----------|------|---------------|-------|-----------------|
| TC-AUTH-001 | `TestAuth::test_password_hashing` | Unit | None | Hash password; verify correct and wrong passwords | Correct password verifies; wrong password fails |
| TC-AUTH-002 | `TestAuth::test_slugify` | Unit | None | Slugify `"My Company Name"` and `"Test!!!"` | `"my-company-name"`, `"test"` |
| TC-AUTH-003 | `TestAuth::test_content_hash` | Unit | None | Hash same string twice; hash different string | Identical input → same hash; different input → different hash |
| TC-AUTH-004 | `TestJWT::test_create_access_token_decodes` | Unit | Default `secret_key` in settings | Create JWT for user/tenant/admin; decode with settings key | Payload contains `sub`, `tenant_id`, `role` |
| TC-AUTH-005 | `TestRBAC::test_admin_has_publish_permission` | Unit | Mock admin user | Call `require_permission("publish")` with admin user | Returns user without HTTP 403 |
| TC-AUTH-006 | `TestRBAC::test_viewer_cannot_write` | Unit | Mock viewer user | Call `require_permission("write")` with viewer user | Raises `HTTPException` status 403 |
| TC-AUTH-007 | `TestRBAC::test_role_permission_matrix` | Unit | None | Assert keys in `ROLE_PERMISSIONS` for admin, approver, viewer | Admin has `publish`; approver has `approve`; viewer lacks `write` |

---

### 5.2 Text chunking (`test_api.py`)

| ID | Test name | Type | Preconditions | Steps | Expected result |
|----|-----------|------|---------------|-------|-----------------|
| TC-CHUNK-001 | `TestChunking::test_chunk_text` | Unit | 2000-word synthetic text | Chunk with size 500, overlap 100 | Multiple chunks; each has `token_count > 0` |
| TC-CHUNK-002 | `TestChunking::test_estimate_tokens` | Unit | String `"hello world test"` | Call `estimate_tokens` | Returns `3` |

---

### 5.3 Citation gate / RAG grounding (`test_citation_gate.py`)

| ID | Test name | Type | Preconditions | Steps | Expected result |
|----|-----------|------|---------------|-------|-----------------|
| TC-CITE-001 | `TestCitationGate::test_no_results_not_grounded` | Unit | Empty search results | `verify_grounding("Some answer", [])` | `grounded=False`, `confidence=0.0` |
| TC-CITE-002 | `TestCitationGate::test_with_results` | Unit | One high-score chunk matching answer | Verify grounding with overlapping answer text | `grounded=True`; citations present |
| TC-CITE-003 | `TestCitationGate::test_build_context_includes_chunk_id` | Unit | Mock `SearchResult` with chunk ID | Build LLM context string | Context includes chunk ID marker |
| TC-CITE-004 | `TestCitationGate::test_extract_citations_by_chunk_id_in_response` | Unit | Answer referencing chunk ID | Extract citations from answer + results | Citation list non-empty |
| TC-CITE-005 | `TestCitationGate::test_abstention_without_citations_is_grounded` | Unit | Answer says "I don't have enough information" | Verify grounding with no forced citations | Treated as valid abstention |
| TC-CITE-006 | `TestCitationGate::test_low_score_not_grounded` | Unit | Search result with very low score | Verify grounding | `grounded=False` |

---

### 5.4 Crawler & SSRF protection (`test_crawler.py`)

| ID | Test name | Type | Preconditions | Steps | Expected result |
|----|-----------|------|---------------|-------|-----------------|
| TC-CRAWL-001 | `TestValidateUrl::test_allows_public_https_url` | Unit | Mock DNS → public IP `93.184.216.34` | `validate_url("https://example.com/docs")` | URL returned unchanged |
| TC-CRAWL-002 | `TestValidateUrl::test_blocks_localhost_hostname` | Unit | None | Validate `http://localhost/admin` | `CrawlError` matching "Blocked hostname" |
| TC-CRAWL-003 | `TestValidateUrl::test_blocks_loopback_ip` | Unit | None | Validate `http://127.0.0.1/secret` | `CrawlError` matching "Blocked IP" |
| TC-CRAWL-004 | `TestValidateUrl::test_blocks_private_ip_192_168` | Unit | None | Validate `http://192.168.1.1/internal` | `CrawlError` matching "Blocked IP" |
| TC-CRAWL-005 | `TestValidateUrl::test_blocks_file_scheme` | Unit | None | Validate `file:///etc/passwd` | `CrawlError` matching "Invalid scheme" |
| TC-CRAWL-006 | `TestValidateUrl::test_blocks_missing_host` | Unit | None | Validate `https:///path-only` | `CrawlError` matching "no host" |
| TC-CRAWL-007 | `TestExtractContent::test_extract_text_strips_scripts_and_gets_title` | Unit | HTML with `<script>` and `<title>` | `extract_text(html)` | Title extracted; body text present; script content excluded |
| TC-CRAWL-008 | `TestExtractContent::test_extract_links_same_domain_only` | Unit | HTML with internal + external links | `extract_links(html, base_url)` | Only same-domain link returned |

---

### 5.5 Configuration & LLM factory (`test_api.py`, `test_config.py`)

| ID | Test name | Type | Preconditions | Steps | Expected result |
|----|-----------|------|---------------|-------|-----------------|
| TC-CFG-001 | `TestLLMFactory::test_ollama_provider_defaults` | Unit | `LLM_PROVIDER=ollama`, no OpenAI key | Load settings | Provider `ollama`; base URL `http://localhost:11434/v1`; sales model `llama3.1:8b`; 768-dim embeddings; collection `gtm_chunks_768` |
| TC-CFG-002 | `TestLLMFactory::test_openai_provider_config` | Unit | `LLM_PROVIDER=openai`, key set | Load settings | Provider `openai`; marketing model `gpt-4o`; 1536-dim embeddings |
| TC-CFG-003 | `TestLLMFactory::test_auto_detect_openai_when_key_set` | Unit | `OPENAI_API_KEY` set, `LLM_PROVIDER` unset | Load settings | Auto-selects `openai` |
| TC-CFG-004 | `TestLLMFactory::test_provider_switch_per_agent` | Unit | Switch env between ollama and openai | Compare `get_agent_model("product_understanding")` | Ollama → `qwen2.5-coder:14b`; OpenAI → `gpt-4o-mini` |
| TC-CFG-005 | `TestLLMFactory::test_get_chat_model_uses_provider_base_url` | Unit | `LLM_PROVIDER=ollama` | `get_chat_model("sales_agent")` | Model name and `openai_api_base` match Ollama config |
| TC-CFG-006 | `TestLLMFactory::test_agent_env_override` | Unit | `AGENT_MODEL_SALES=custom-model:7b` | Load settings | Sales agent uses override model |
| TC-CFG-007 | `TestConfig::test_get_all_agent_models_ollama` | Unit | Ollama provider | `get_all_agent_models()` | All seven agent types mapped to Ollama models |
| TC-CFG-008 | `TestConfig::test_openai_agent_env_override` | Unit | OpenAI + `AGENT_MODEL_MARKETING=gpt-4-turbo` | Load settings | Marketing strategy uses override |
| TC-CFG-009 | `TestConfig::test_qdrant_collection_suffix_openai` | Unit | OpenAI provider | Load settings | Collection resolves to `gtm_chunks_1536` |

---

### 5.6 LLM embeddings & health (`test_llm_integration.py`)

| ID | Test name | Type | Preconditions | Steps | Expected result |
|----|-----------|------|---------------|-------|-----------------|
| TC-LLM-001 | `TestLLMIntegration::test_embedding_dimensions_per_provider` | Unit | Ollama then OpenAI env | Instantiate `EmbeddingService` per provider | 768 vs 1536 dimensions |
| TC-LLM-002 | `TestLLMIntegration::test_embedding_service_backend_ollama` | Unit | Ollama env | Check embedding service config | Uses Ollama base URL and `nomic-embed-text` |
| TC-LLM-003 | `TestLLMIntegration::test_embedding_service_backend_openai` | Unit | OpenAI env | Check embedding service config | Uses OpenAI model and 1536 dimensions |
| TC-LLM-004 | `TestLLMIntegration::test_ollama_embed_missing_model_clear_error` | Integration | Mock `/api/tags` without embed model | Call `embed_query` | Raises `LLMServiceError` with `ollama pull` hint |
| TC-LLM-005 | `TestLLMIntegration::test_ollama_embed_query_native_api` | Integration | Mock `/api/tags` + `/api/embed` | Call `embed_query("hello")` | Returns 768-dim vector |
| TC-LLM-006 | `TestLLMIntegration::test_check_llm_health_ollama_reachable` | Integration | Mock Ollama tags with all models | `check_llm_health()` | `llm_ready=True`, models listed |
| TC-LLM-007 | `TestLLMIntegration::test_check_llm_health_ollama_unreachable` | Integration | Mock connection failure | `check_llm_health()` | `llm_ready=False`, error message set |
| TC-LLM-008 | `TestLLMIntegration::test_check_llm_health_openai_with_key` | Integration | OpenAI key present | `check_llm_health()` | `llm_ready=True` |
| TC-LLM-009 | `TestLLMIntegration::test_check_llm_health_openai_missing_key` | Integration | No OpenAI key | `check_llm_health()` | `llm_ready=False`, message set |
| TC-LLM-010 | `TestLLMIntegration::test_check_llm_health_reports_missing_models` | Integration | Mock tags missing configured model | `check_llm_health()` | `missing_models` non-empty |
| TC-LLM-011 | `TestLLMIntegration::test_health_endpoint_includes_llm_status` | Integration | Patched DB + LLM health | `GET /health` via TestClient | JSON includes `llm_provider`, `embedding_model`, etc. |

---

### 5.7 HTTP API & exception handlers (`test_api_integration.py`)

| ID | Test name | Type | Preconditions | Steps | Expected result |
|----|-----------|------|---------------|-------|-----------------|
| TC-API-001 | `TestHealthEndpoint::test_health_live_refresh_llm` | Integration | Mock DB ready + LLM healthy | `GET /health` | Status 200; `status=healthy`; `llm_ready=True`; health check invoked (lifespan + request) |
| TC-API-002 | `TestHealthEndpoint::test_health_degraded_when_models_missing` | Integration | Mock LLM with missing models | `GET /health` | `status=degraded`; `llm_ready=False` |
| TC-API-003 | `TestExceptionHandlers::test_llm_service_error_handler_returns_503` | Integration | None | Invoke `llm_service_error_handler` with `LLMServiceError` | HTTP 503; body mentions `ollama pull` |

---

### 5.8 Multi-agent supervisor routing (`test_supervisor.py`)

| ID | Test name | Type | Preconditions | Steps | Expected result |
|----|-----------|------|---------------|-------|-----------------|
| TC-SUP-001 | `test_routes_request_types[ingest-discovery]` | Unit | `request_type=ingest` | `route_request(state)` | Routes to `discovery`; updates `state["routed_agent"]` |
| TC-SUP-002 | `test_routes_request_types[understand-discovery]` | Unit | `request_type=understand` | Same | Routes to `discovery` |
| TC-SUP-003 | `test_routes_request_types[query-sales]` | Unit | `request_type=query` | Same | Routes to `sales` |
| TC-SUP-004 | `test_routes_request_types[chat-sales]` | Unit | `request_type=chat` | Same | Routes to `sales` |
| TC-SUP-005 | `test_routes_request_types[strategy-marketing]` | Unit | `request_type=strategy` | Same | Routes to `marketing` |
| TC-SUP-006 | `test_routes_request_types[content-content]` | Unit | `request_type=content` | Same | Routes to `content` |
| TC-SUP-007 | `test_routes_request_types[outreach-outreach]` | Unit | `request_type=outreach` | Same | Routes to `outreach` |
| TC-SUP-008 | `test_routes_request_types[architect-solution]` | Unit | `request_type=architect` | Same | Routes to `solution` |
| TC-SUP-009 | `test_routes_request_types[proposal-proposal]` | Unit | `request_type=proposal` | Same | Routes to `proposal` |
| TC-SUP-010 | `test_routes_request_types[analytics-analytics]` | Unit | `request_type=analytics` | Same | Routes to `analytics` |
| TC-SUP-011 | `test_routes_request_types[refresh-learning]` | Unit | `request_type=refresh` | Same | Routes to `learning` |
| TC-SUP-012 | `test_routes_request_types[publish-content]` | Unit | `request_type=publish` | Same | Routes to `content` |
| TC-SUP-013 | `TestSupervisorRouting::test_unknown_request_defaults_to_sales` | Unit | Unknown `request_type` | `route_request(state)` | Defaults to `sales` |

---

### 5.9 Enterprise plan features (`test_api.py`)

| ID | Test name | Type | Preconditions | Steps | Expected result |
|----|-----------|------|---------------|-------|-----------------|
| TC-ENT-001 | `TestEnterprise::test_plan_features` | Unit | None | `get_plan_features("starter")` and `("enterprise")` | Starter: 1 product, no SSO; Enterprise: SSO + private deploy |

---

## 6. File map

| File | Test classes | Count |
|------|--------------|-------|
| `tests/test_api.py` | `TestAuth`, `TestChunking`, `TestEnterprise`, `TestLLMFactory` | 12 |
| `tests/test_auth_rbac.py` | `TestJWT`, `TestRBAC` | 4 |
| `tests/test_citation_gate.py` | `TestCitationGate` | 6 |
| `tests/test_config.py` | `TestConfig` | 3 |
| `tests/test_crawler.py` | `TestValidateUrl`, `TestExtractContent` | 8 |
| `tests/test_llm_integration.py` | `TestLLMIntegration` | 11 |
| `tests/test_api_integration.py` | `TestHealthEndpoint`, `TestExceptionHandlers` | 3 |
| `tests/test_supervisor.py` | `TestSupervisorRouting` | 13 |
| `tests/conftest.py` | Shared fixtures | — |

---

## 7. Mapping tests to platform phases

| Phase | Concern | Covered by |
|-------|---------|------------|
| 1 — Ingestion | SSRF-safe crawl, HTML extract | TC-CRAWL-* |
| 1 — Ingestion | Text chunking | TC-CHUNK-* |
| 2 — Knowledge | Embedding dimensions / provider | TC-LLM-001–003, TC-CFG-* |
| 3 — Grounded answers | Citation gate | TC-CITE-* |
| 4 — Marketing | Strategy agent model routing | TC-CFG-004, TC-SUP-005 |
| 5 — Sales | Sales chat routing | TC-SUP-003, TC-SUP-004 |
| 6 — Publishing | RBAC publish permission | TC-AUTH-005 |
| 11 — Supervisor | Request routing table | TC-SUP-* |
| 12 — Enterprise | Plan feature flags | TC-ENT-001 |
| Infra | LLM health + `/health` | TC-LLM-006–011, TC-API-* |

---

## 8. Gaps & roadmap

These scenarios are **not** automated yet. Recommended next tests:

| Priority | Proposed ID | Scenario | Suggested approach |
|----------|-------------|----------|-------------------|
| P0 | TC-ING-001 | Crawl → chunk → embed pipeline | Mock crawler + httpx embed; assert chunk count |
| P0 | TC-API-010 | `POST /api/v1/products` CRUD with auth | TestClient + SQLite test DB |
| P1 | TC-TEN-001 | Cross-tenant Qdrant isolation | Mock vector store; assert tenant filter |
| P1 | TC-PUB-001 | Approval blocks publish | Mock user roles + publishing service |
| P1 | TC-SUP-020 | Supervisor invokes real agent graph | Mock `get_chat_model().invoke` |
| P2 | TC-AGT-001 | Build Product Profile happy path | Mock LLM JSON response + test DB |
| P2 | TC-AGT-002 | Generate GTM Strategy happy path | Same pattern |
| P2 | TC-E2E-001 | Live Ollama smoke (optional, manual CI job) | `@pytest.mark.live` gated by env flag |

Mark live-service tests with a pytest marker so default CI stays fast and offline:

```python
# pytest.ini (future)
# markers =
#     live: requires running Ollama/Postgres
```

---

## 9. Related documentation

| Document | Contents |
|----------|----------|
| [dev-guide.md](./dev-guide.md) | Local setup, `make test`, troubleshooting |
| [ollama-llm-integration.md](./ollama-llm-integration.md) | Dual LLM provider design and health behavior |
| [gtm-platform-phases.md](./gtm-platform-phases.md) | 12-phase implementation status and acceptance criteria |

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-07-31 | Initial document — 60 tests across 9 files; SSRF, citation gate, RBAC, supervisor, LLM integration added |
