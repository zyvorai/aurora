"""Tests for Emissary API."""

import pytest
from gtm_api.auth import hash_password, verify_password, slugify, content_hash
from gtm_api.config import get_settings
from gtm_api.services.chunking import chunk_text, compact_profile, estimate_tokens, truncate_to_token_budget
from gtm_api.services.llm import get_chat_model, get_provider


class TestAuth:
    def test_password_hashing(self):
        hashed = hash_password("testpassword123")
        assert verify_password("testpassword123", hashed)
        assert not verify_password("wrongpassword", hashed)

    def test_slugify(self):
        assert slugify("My Company Name") == "my-company-name"
        assert slugify("Test!!!") == "test"

    def test_content_hash(self):
        h1 = content_hash("hello world")
        h2 = content_hash("hello world")
        h3 = content_hash("different")
        assert h1 == h2
        assert h1 != h3


class TestChunking:
    def test_chunk_text(self):
        text = " ".join(["word"] * 2000)
        chunks = chunk_text(text, chunk_size=500, chunk_overlap=100)
        assert len(chunks) > 1
        assert all(c.token_count > 0 for c in chunks)

    def test_estimate_tokens(self):
        assert estimate_tokens("hello world test") == 3

    def test_truncate_to_token_budget(self):
        text = " ".join(["word"] * 100)
        assert estimate_tokens(truncate_to_token_budget(text, 20)) <= 21
        assert "...[truncated]" in truncate_to_token_budget(text, 20)

    def test_compact_profile(self):
        profile = compact_profile({
            "summary": "x" * 5000,
            "features": list(range(20)),
            "field_status": {"a": "inferred"},
        })
        assert "field_status" not in profile
        assert len(profile["features"]) <= 8


class TestEnterprise:
    def test_plan_features(self):
        from gtm_api.services.enterprise import get_plan_features
        starter = get_plan_features("starter")
        assert starter["products"] == 1
        assert not starter["sso"]
        enterprise = get_plan_features("enterprise")
        assert enterprise["sso"]
        assert enterprise["private_deploy"]


class TestLLMFactory:
    def test_ollama_provider_defaults(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        get_settings.cache_clear()
        settings = get_settings()
        assert settings.resolved_llm_provider() == "ollama"
        assert settings.llm_base_url == "http://localhost:11434/v1"
        assert settings.get_agent_model("sales_agent") == "llama3.1:8b"
        assert settings.embedding_dimensions == 768
        assert settings.qdrant_collection_resolved == "gtm_chunks_768"

    def test_openai_provider_config(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")
        get_settings.cache_clear()
        settings = get_settings()
        assert settings.resolved_llm_provider() == "openai"
        assert settings.llm_api_key == "sk-test-key"
        assert settings.get_agent_model("marketing_strategy") == "gpt-4o"
        assert settings.embedding_dimensions == 1536

    def test_auto_detect_openai_when_key_set(self, monkeypatch):
        monkeypatch.delenv("LLM_PROVIDER", raising=False)
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")
        get_settings.cache_clear()
        settings = get_settings()
        assert settings.resolved_llm_provider() == "openai"

    def test_provider_switch_per_agent(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        get_settings.cache_clear()
        ollama_settings = get_settings()
        assert ollama_settings.get_agent_model("product_understanding") == "llama3.1:8b"

        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        get_settings.cache_clear()
        openai_settings = get_settings()
        assert openai_settings.get_agent_model("product_understanding") == "gpt-4o-mini"

    def test_get_chat_model_uses_provider_base_url(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        get_settings.cache_clear()
        llm = get_chat_model("sales_agent")
        assert llm.model_name == "llama3.1:8b"
        assert str(llm.openai_api_base) == "http://localhost:11434/v1"
        assert get_provider() == "ollama"

    def test_agent_env_override(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("AGENT_MODEL_SALES", "custom-model:7b")
        get_settings.cache_clear()
        settings = get_settings()
        assert settings.get_agent_model("sales_agent") == "custom-model:7b"
