"""Embedding service with dual-provider support (Ollama + OpenAI)."""

from typing import Optional, Protocol

import httpx
from langchain_openai import OpenAIEmbeddings

from gtm_api.config import get_settings


class LLMServiceError(Exception):
    """Raised when chat or embedding provider is unreachable or misconfigured."""

    def __init__(self, message: str, provider: str = "") -> None:
        self.provider = provider
        super().__init__(message)


class _EmbeddingBackend(Protocol):
    async def embed_documents(self, texts: list[str]) -> list[list[float]]: ...
    async def embed_query(self, query: str) -> list[float]: ...


class OllamaEmbeddingBackend:
    """Native Ollama /api/embed (falls back to /v1/embeddings)."""

    def __init__(self, base_url: str, model: str) -> None:
        host = base_url.replace("/v1", "").rstrip("/")
        self._host = host
        self._embed_url = host + "/api/embed"
        self._openai_embed_url = host + "/v1/embeddings"
        self._tags_url = host + "/api/tags"
        self._model = model

    def _model_matches(self, available_name: str) -> bool:
        base = self._model.split(":")[0]
        name = available_name.split(":")[0]
        return name == base or available_name == self._model

    async def _list_models(self, client: httpx.AsyncClient) -> list[str]:
        response = await client.get(self._tags_url)
        response.raise_for_status()
        return [m.get("name", "") for m in response.json().get("models", [])]

    async def _resolve_model(self, client: httpx.AsyncClient) -> str:
        available = await self._list_models(client)
        for name in available:
            if self._model_matches(name):
                return name
        hint = self._model.split(":")[0]
        raise LLMServiceError(
            f"Ollama embedding model '{self._model}' is not installed. "
            f"Pulled models: {available or '(none)'}. "
            f"Run: ollama pull {hint}",
            provider="ollama",
        )

    async def _embed_via_native(self, client: httpx.AsyncClient, model: str, texts: list[str]) -> list[list[float]]:
        payload = {"model": model, "input": texts if len(texts) > 1 else texts[0]}
        response = await client.post(self._embed_url, json=payload)
        if response.status_code == 404:
            return await self._embed_via_openai_compat(client, model, texts)
        response.raise_for_status()
        data = response.json()
        embeddings = data.get("embeddings")
        if not embeddings:
            raise LLMServiceError(
                f"Ollama returned no embeddings for model '{model}'.",
                provider="ollama",
            )
        return embeddings

    async def _embed_via_openai_compat(
        self, client: httpx.AsyncClient, model: str, texts: list[str]
    ) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            response = await client.post(
                self._openai_embed_url,
                json={"model": model, "input": text},
            )
            response.raise_for_status()
            data = response.json()
            items = data.get("data") or []
            if not items:
                raise LLMServiceError(
                    f"Ollama /v1/embeddings returned no data for model '{model}'.",
                    provider="ollama",
                )
            vectors.append(items[0]["embedding"])
        return vectors

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                model = await self._resolve_model(client)
                return await self._embed_via_native(client, model, texts)
        except LLMServiceError:
            raise
        except httpx.HTTPError as exc:
            raise LLMServiceError(
                f"Ollama embedding failed. Ensure Ollama is running (ollama serve). Detail: {exc}",
                provider="ollama",
            ) from exc

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts)

    async def embed_query(self, query: str) -> list[float]:
        vectors = await self._embed([query])
        return vectors[0]


class OpenAIEmbeddingBackend:
    def __init__(self, settings) -> None:
        self._client = OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
            dimensions=settings.embedding_dimensions,
        )

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        try:
            return await self._client.aembed_documents(texts)
        except Exception as exc:
            raise LLMServiceError(
                f"OpenAI embedding failed. Check OPENAI_API_KEY. Detail: {exc}",
                provider="openai",
            ) from exc

    async def embed_query(self, query: str) -> list[float]:
        try:
            return await self._client.aembed_query(query)
        except Exception as exc:
            raise LLMServiceError(
                f"OpenAI embedding failed. Check OPENAI_API_KEY. Detail: {exc}",
                provider="openai",
            ) from exc


class EmbeddingService:
    def __init__(self) -> None:
        self._backend: Optional[_EmbeddingBackend] = None
        self._provider: Optional[str] = None

    def _get_backend(self) -> _EmbeddingBackend:
        settings = get_settings()
        provider = settings.resolved_llm_provider()
        if self._backend is None or self._provider != provider:
            if provider == "openai":
                self._backend = OpenAIEmbeddingBackend(settings)
            else:
                self._backend = OllamaEmbeddingBackend(
                    settings.ollama_base_url,
                    settings.embedding_model,
                )
            self._provider = provider
        return self._backend

    @property
    def dimensions(self) -> int:
        return get_settings().embedding_dimensions

    @property
    def model(self) -> str:
        return get_settings().embedding_model

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return await self._get_backend().embed_documents(texts)

    async def embed_query(self, query: str) -> list[float]:
        return await self._get_backend().embed_query(query)


embedding_service = EmbeddingService()
