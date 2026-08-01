"""Unit tests for configuration and provider resolution."""

from gtm_api.config import get_settings


class TestConfig:
    def test_get_all_agent_models_ollama(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        settings = get_settings()
        models = settings.get_all_agent_models()
        assert models["sales_agent"] == "llama3.1:8b"
        assert models["product_understanding"] == "llama3.1:8b"
        assert len(models) >= 7

    def test_openai_agent_env_override(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        monkeypatch.setenv("OPENAI_AGENT_MODEL_MARKETING_STRATEGY", "gpt-4o-mini")
        settings = get_settings()
        assert settings.get_agent_model("marketing_strategy") == "gpt-4o-mini"

    def test_qdrant_collection_suffix_openai(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        settings = get_settings()
        assert settings.qdrant_collection_resolved == "gtm_chunks_1536"
