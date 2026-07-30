"""API integration tests (HTTP layer, mocked externals)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from gtm_api.main import app
from gtm_api.services.embeddings import LLMServiceError


class TestHealthEndpoint:
    def test_health_live_refresh_llm(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "openai")
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

        mock_db = AsyncMock(return_value={"db_ready": True, "db_message": None})
        mock_llm = AsyncMock(
            return_value={
                "llm_provider": "openai",
                "llm_ready": True,
                "llm_reachable": True,
                "chat_models": {"sales_agent": "gpt-4o-mini"},
                "embedding_model": "text-embedding-3-small",
                "embedding_dimensions": 1536,
                "available_models": ["openai-managed"],
                "missing_models": [],
                "message": None,
            }
        )

        with (
            patch("gtm_api.main.check_database", mock_db),
            patch("gtm_api.main.check_llm_health", mock_llm),
        ):
            with TestClient(app) as client:
                response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["llm_ready"] is True
        # Lifespan startup + /health both refresh LLM state
        assert mock_llm.call_count >= 1

    def test_health_degraded_when_models_missing(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")

        with (
            patch(
                "gtm_api.main.check_database",
                AsyncMock(return_value={"db_ready": True, "db_message": None}),
            ),
            patch(
                "gtm_api.main.check_llm_health",
                AsyncMock(
                    return_value={
                        "llm_provider": "ollama",
                        "llm_ready": False,
                        "llm_reachable": True,
                        "missing_models": ["nomic-embed-text"],
                        "message": "Run: make ollama-pull",
                    }
                ),
            ),
        ):
            with TestClient(app) as client:
                data = client.get("/health").json()

        assert data["status"] == "degraded"
        assert data["llm_ready"] is False


class TestExceptionHandlers:
    @pytest.mark.asyncio
    async def test_llm_service_error_handler_returns_503(self):
        from gtm_api.main import llm_service_error_handler

        response = await llm_service_error_handler(
            None,
            LLMServiceError("Model not installed. Run: ollama pull nomic-embed-text", "ollama"),
        )
        assert response.status_code == 503
        assert "ollama pull" in response.body.decode()
