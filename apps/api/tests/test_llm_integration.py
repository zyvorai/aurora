"""Integration tests for dual-provider LLM layer (Ollama + OpenAI)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from gtm_api.config import get_settings
from gtm_api.main import app
from gtm_api.services.embeddings import EmbeddingService, LLMServiceError
from gtm_api.services.llm import check_llm_health


class TestLLMIntegration:
    def test_embedding_dimensions_per_provider(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        get_settings.cache_clear()
        ollama_service = EmbeddingService()
        assert ollama_service.dimensions == 768
        assert ollama_service.model == "nomic-embed-text"

        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        get_settings.cache_clear()
        openai_service = EmbeddingService()
        assert openai_service.dimensions == 1536
        assert openai_service.model == "text-embedding-3-small"

    def test_embedding_service_backend_ollama(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        get_settings.cache_clear()
        from gtm_api.services.embeddings import OllamaEmbeddingBackend

        service = EmbeddingService()
        backend = service._get_backend()
        assert isinstance(backend, OllamaEmbeddingBackend)
        assert backend._model == "nomic-embed-text"
        assert backend._embed_url == "http://localhost:11434/api/embed"

    def test_embedding_service_backend_openai(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")
        get_settings.cache_clear()
        from gtm_api.services.embeddings import OpenAIEmbeddingBackend

        service = EmbeddingService()
        backend = service._get_backend()
        assert isinstance(backend, OpenAIEmbeddingBackend)
        assert backend._client.model == "text-embedding-3-small"

    @pytest.mark.asyncio
    async def test_ollama_embed_missing_model_clear_error(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        get_settings.cache_clear()

        tags_response = MagicMock()
        tags_response.status_code = 200
        tags_response.json.return_value = {"models": []}
        tags_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=tags_response)
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value = mock_client
        mock_context.__aexit__.return_value = None

        with patch("gtm_api.services.embeddings.httpx.AsyncClient", return_value=mock_context):
            service = EmbeddingService()
            with pytest.raises(LLMServiceError) as exc_info:
                await service.embed_query("hello")

        assert "not installed" in str(exc_info.value).lower()
        assert "ollama pull" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_ollama_embed_query_native_api(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        get_settings.cache_clear()

        tags_response = MagicMock()
        tags_response.status_code = 200
        tags_response.json.return_value = {"models": [{"name": "nomic-embed-text:latest"}]}
        tags_response.raise_for_status = MagicMock()

        embed_response = MagicMock()
        embed_response.status_code = 200
        embed_response.json.return_value = {"embeddings": [[0.1, 0.2, 0.3]]}
        embed_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=tags_response)
        mock_client.post = AsyncMock(return_value=embed_response)
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value = mock_client
        mock_context.__aexit__.return_value = None

        with patch("gtm_api.services.embeddings.httpx.AsyncClient", return_value=mock_context):
            service = EmbeddingService()
            vector = await service.embed_query("hello")

        assert vector == [0.1, 0.2, 0.3]
        post_kwargs = mock_client.post.call_args[1]["json"]
        assert post_kwargs["model"] == "nomic-embed-text:latest"
        assert post_kwargs["input"] == "hello"

    @pytest.mark.asyncio
    async def test_check_llm_health_ollama_reachable(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        get_settings.cache_clear()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [
                {"name": "llama3.1:8b"},
                {"name": "qwen2.5-coder:14b"},
                {"name": "deepseek-r1:8b"},
                {"name": "gemma2:9b"},
                {"name": "nomic-embed-text:latest"},
            ]
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value = mock_client
        mock_context.__aexit__.return_value = None

        with patch("gtm_api.services.llm.httpx.AsyncClient", return_value=mock_context):
            result = await check_llm_health()

        assert result["llm_provider"] == "ollama"
        assert result["llm_reachable"] is True
        assert result["llm_ready"] is True
        assert result["missing_models"] == []
        assert "llama3.1:8b" in result["available_models"]
        assert result["embedding_model"] == "nomic-embed-text"
        assert result["embedding_dimensions"] == 768
        assert "sales_agent" in result["chat_models"]

    @pytest.mark.asyncio
    async def test_check_llm_health_ollama_unreachable(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        get_settings.cache_clear()

        mock_context = AsyncMock()
        mock_context.__aenter__.side_effect = ConnectionError("Connection refused")
        mock_context.__aexit__.return_value = None

        with patch("gtm_api.services.llm.httpx.AsyncClient", return_value=mock_context):
            result = await check_llm_health()

        assert result["llm_provider"] == "ollama"
        assert result["llm_reachable"] is False
        assert result["llm_ready"] is False
        assert "Ollama is not reachable" in result["message"]

    @pytest.mark.asyncio
    async def test_check_llm_health_openai_with_key(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-live-key")
        get_settings.cache_clear()

        result = await check_llm_health()

        assert result["llm_provider"] == "openai"
        assert result["llm_ready"] is True
        assert result["embedding_dimensions"] == 1536
        assert result["available_models"] == ["openai-managed"]

    @pytest.mark.asyncio
    async def test_check_llm_health_openai_missing_key(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        get_settings.cache_clear()

        result = await check_llm_health()

        assert result["llm_provider"] == "openai"
        assert result["llm_ready"] is False
        assert result["message"] == "OPENAI_API_KEY is not set"

    @pytest.mark.asyncio
    async def test_check_llm_health_reports_missing_models(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        get_settings.cache_clear()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"models": [{"name": "llama3.1:8b"}]}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_context = AsyncMock()
        mock_context.__aenter__.return_value = mock_client
        mock_context.__aexit__.return_value = None

        with patch("gtm_api.services.llm.httpx.AsyncClient", return_value=mock_context):
            result = await check_llm_health()

        assert result["llm_reachable"] is True
        assert result["llm_ready"] is False
        assert isinstance(result["missing_models"], list)
        assert len(result["missing_models"]) > 0
        assert "make ollama-pull" in result["message"]

    def test_health_endpoint_includes_llm_status(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
        get_settings.cache_clear()

        with TestClient(app) as client:
            response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ("healthy", "degraded")
        assert "db_ready" in data
        assert data["llm_provider"] == "openai"
        assert "llm_ready" in data
        assert "chat_models" in data
        assert "embedding_model" in data
        assert "embedding_dimensions" in data
