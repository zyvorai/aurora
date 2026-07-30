"""GTM Platform API configuration."""

import os
from functools import lru_cache
from typing import ClassVar

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_OLLAMA_AGENT_MODELS: dict[str, str] = {
    "product_understanding": "qwen2.5-coder:14b",
    "marketing_strategy": "deepseek-r1:8b",
    "content_studio": "llama3.1:8b",
    "sales_agent": "llama3.1:8b",
    "outreach": "gemma2:9b",
    "solution_architect": "deepseek-r1:8b",
    "proposal_generator": "deepseek-r1:8b",
}

DEFAULT_OPENAI_AGENT_MODELS: dict[str, str] = {
    "product_understanding": "gpt-4o-mini",
    "marketing_strategy": "gpt-4o",
    "content_studio": "gpt-4o-mini",
    "sales_agent": "gpt-4o-mini",
    "outreach": "gpt-4o-mini",
    "solution_architect": "gpt-4o",
    "proposal_generator": "gpt-4o",
}

AGENT_ENV_KEYS: dict[str, tuple[str, str]] = {
    "product_understanding": ("AGENT_MODEL_PRODUCT_UNDERSTANDING", "OPENAI_AGENT_MODEL_PRODUCT_UNDERSTANDING"),
    "marketing_strategy": ("AGENT_MODEL_MARKETING_STRATEGY", "OPENAI_AGENT_MODEL_MARKETING_STRATEGY"),
    "content_studio": ("AGENT_MODEL_CONTENT_STUDIO", "OPENAI_AGENT_MODEL_CONTENT_STUDIO"),
    "sales_agent": ("AGENT_MODEL_SALES", "OPENAI_AGENT_MODEL_SALES"),
    "outreach": ("AGENT_MODEL_OUTREACH", "OPENAI_AGENT_MODEL_OUTREACH"),
    "solution_architect": ("AGENT_MODEL_SOLUTION_ARCHITECT", "OPENAI_AGENT_MODEL_SOLUTION_ARCHITECT"),
    "proposal_generator": ("AGENT_MODEL_PROPOSAL", "OPENAI_AGENT_MODEL_PROPOSAL"),
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "GTM Agent Platform"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://gtm:gtm_dev@localhost:5432/gtm_platform"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "gtm_chunks"

    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "gtm_dev_neo4j"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "gtm_minio"
    minio_secret_key: str = "gtm_minio_dev"
    minio_bucket: str = "gtm-artifacts"
    minio_secure: bool = False

    # Auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # LLM provider: ollama | openai | "" (auto-detect from OPENAI_API_KEY)
    llm_provider: str = ""

    # Ollama (default dev)
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_api_key: str = "ollama"
    ollama_default_model: str = "llama3.1:8b"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_embedding_dimensions: int = 768

    # OpenAI (production / premium) — backward compatible
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536

    # Crawler
    crawl_max_pages: int = 100
    crawl_timeout_seconds: int = 30
    crawl_user_agent: str = "GTMPlatformBot/1.0"

    # Quotas (per tenant per month)
    quota_tokens: int = 1_000_000
    quota_pages: int = 10_000
    quota_products_starter: int = 1
    quota_products_growth: int = 10
    quota_products_enterprise: int = 1000

    OLLAMA_AGENT_MODELS: ClassVar[dict[str, str]] = DEFAULT_OLLAMA_AGENT_MODELS
    OPENAI_AGENT_MODELS: ClassVar[dict[str, str]] = DEFAULT_OPENAI_AGENT_MODELS

    def resolved_llm_provider(self) -> str:
        if self.llm_provider.strip().lower() in ("ollama", "openai"):
            return self.llm_provider.strip().lower()
        if self.openai_api_key.strip():
            return "openai"
        return "ollama"

    @property
    def llm_base_url(self) -> str:
        if self.resolved_llm_provider() == "openai":
            return self.openai_base_url
        return self.ollama_base_url

    @property
    def llm_api_key(self) -> str:
        if self.resolved_llm_provider() == "openai":
            return self.openai_api_key
        return self.ollama_api_key

    @property
    def embedding_model(self) -> str:
        if self.resolved_llm_provider() == "openai":
            return self.openai_embedding_model
        return self.ollama_embedding_model

    @property
    def embedding_dimensions(self) -> int:
        if self.resolved_llm_provider() == "openai":
            return self.openai_embedding_dimensions
        return self.ollama_embedding_dimensions

    @property
    def qdrant_collection_resolved(self) -> str:
        return f"{self.qdrant_collection}_{self.embedding_dimensions}"

    def get_agent_model(self, agent_type: str) -> str:
        provider = self.resolved_llm_provider()
        defaults = self.OPENAI_AGENT_MODELS if provider == "openai" else self.OLLAMA_AGENT_MODELS
        fallback = self.openai_model if provider == "openai" else self.ollama_default_model

        env_keys = AGENT_ENV_KEYS.get(agent_type)
        if env_keys:
            ollama_key, openai_key = env_keys
            override = os.getenv(openai_key if provider == "openai" else ollama_key)
            if override:
                return override

        return defaults.get(agent_type, fallback)

    def get_all_agent_models(self) -> dict[str, str]:
        keys = set(self.OLLAMA_AGENT_MODELS) | set(self.OPENAI_AGENT_MODELS)
        return {agent: self.get_agent_model(agent) for agent in keys}


@lru_cache
def get_settings() -> Settings:
    return Settings()
