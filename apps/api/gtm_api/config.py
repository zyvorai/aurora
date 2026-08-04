"""GTM Platform API configuration."""

import os
from functools import lru_cache
from typing import ClassVar

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_OLLAMA_AGENT_MODELS: dict[str, str] = {
    # Legacy module keys (backward compatible)
    "product_understanding": "llama3.1:8b",
    "marketing_strategy": "llama3.1:8b",
    "content_studio": "llama3.1:8b",
    "sales_agent": "llama3.1:8b",
    "outreach": "gemma2:9b",
    "solution_architect": "llama3.1:8b",
    "proposal_generator": "llama3.1:8b",
    # 11-agent catalog keys
    "product": "llama3.1:8b",
    "market_research": "llama3.1:8b",
    "lead_discovery": "llama3.1:8b",
    "lead_qualification": "llama3.1:8b",
    "campaign": "llama3.1:8b",
    "sales_engineer": "llama3.1:8b",
    "proposal": "llama3.1:8b",
    "crm": "llama3.1:8b",
    "customer_success": "llama3.1:8b",
    "analytics": "llama3.1:8b",
}

DEFAULT_OPENAI_AGENT_MODELS: dict[str, str] = {
    "product_understanding": "gpt-4o-mini",
    "marketing_strategy": "gpt-4o",
    "content_studio": "gpt-4o-mini",
    "sales_agent": "gpt-4o-mini",
    "outreach": "gpt-4o-mini",
    "solution_architect": "gpt-4o",
    "proposal_generator": "gpt-4o",
    "product": "gpt-4o-mini",
    "campaign": "gpt-4o-mini",
    "sales_engineer": "gpt-4o",
    "proposal": "gpt-4o",
    "crm": "gpt-4o-mini",
    "customer_success": "gpt-4o-mini",
    "analytics": "gpt-4o-mini",
}

AGENT_ENV_KEYS: dict[str, tuple[str, str]] = {
    "product_understanding": ("AGENT_MODEL_PRODUCT_UNDERSTANDING", "OPENAI_AGENT_MODEL_PRODUCT_UNDERSTANDING"),
    "marketing_strategy": ("AGENT_MODEL_MARKETING_STRATEGY", "OPENAI_AGENT_MODEL_MARKETING_STRATEGY"),
    "content_studio": ("AGENT_MODEL_CONTENT_STUDIO", "OPENAI_AGENT_MODEL_CONTENT_STUDIO"),
    "sales_agent": ("AGENT_MODEL_SALES", "OPENAI_AGENT_MODEL_SALES"),
    "outreach": ("AGENT_MODEL_OUTREACH", "OPENAI_AGENT_MODEL_OUTREACH"),
    "solution_architect": ("AGENT_MODEL_SOLUTION_ARCHITECT", "OPENAI_AGENT_MODEL_SOLUTION_ARCHITECT"),
    "proposal_generator": ("AGENT_MODEL_PROPOSAL", "OPENAI_AGENT_MODEL_PROPOSAL"),
    "product": ("AGENT_MODEL_PRODUCT", "OPENAI_AGENT_MODEL_PRODUCT"),
    "market_research": ("AGENT_MODEL_MARKET_RESEARCH", "OPENAI_AGENT_MODEL_MARKET_RESEARCH"),
    "lead_discovery": ("AGENT_MODEL_LEAD_DISCOVERY", "OPENAI_AGENT_MODEL_LEAD_DISCOVERY"),
    "lead_qualification": ("AGENT_MODEL_LEAD_QUALIFICATION", "OPENAI_AGENT_MODEL_LEAD_QUALIFICATION"),
    "campaign": ("AGENT_MODEL_CAMPAIGN", "OPENAI_AGENT_MODEL_CAMPAIGN"),
    "sales_engineer": ("AGENT_MODEL_SALES_ENGINEER", "OPENAI_AGENT_MODEL_SALES_ENGINEER"),
    "proposal": ("AGENT_MODEL_PROPOSAL_AGENT", "OPENAI_AGENT_MODEL_PROPOSAL_AGENT"),
    "crm": ("AGENT_MODEL_CRM", "OPENAI_AGENT_MODEL_CRM"),
    "customer_success": ("AGENT_MODEL_CUSTOMER_SUCCESS", "OPENAI_AGENT_MODEL_CUSTOMER_SUCCESS"),
    "analytics": ("AGENT_MODEL_ANALYTICS", "OPENAI_AGENT_MODEL_ANALYTICS"),
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

    # lean | full — lean uses one chat model for all agents (8–16 GB hardware)
    llm_profile: str = "full"
    llm_single_model: str = ""
    llm_burst_agents: str = ""

    # minimal | full — minimal skips Neo4j/Redis workers; artifacts in Postgres
    deployment_profile: str = "full"
    enable_neo4j: bool = True
    enable_redis_workers: bool = True
    enable_external_crm_sync: bool = False
    external_crm_provider: str = ""

    # Ollama (default dev)
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_api_key: str = "ollama"
    ollama_default_model: str = "llama3.1:8b"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_embedding_dimensions: int = 768
    ollama_num_ctx: int = 8192

    # OpenAI (production / premium) — backward compatible
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536

    # MCP context hub — multi-source inputs for LLM decisions
    mcp_context_enabled: bool = True
    mcp_external_enabled: bool = False
    mcp_context_providers: str = "rag,profile,crm,analytics,brief,leads"
    mcp_servers: str = "[]"
    mcp_timeout_seconds: int = 15
    mcp_max_blocks: int = 8

    # Crawler
    crawl_max_pages: int = 100
    crawl_timeout_seconds: int = 30
    crawl_user_agent: str = "GTMPlatformBot/1.0"

    # Source uploads (MinIO)
    upload_max_bytes: int = 100 * 1024 * 1024
    upload_max_media_bytes: int = 500 * 1024 * 1024
    whisper_enabled: bool = False
    whisper_max_duration_seconds: int = 3600
    db_source_max_rows_per_table: int = 10_000

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
        from gtm_api.agents.registry import LEGACY_MODEL_KEY_ALIASES

        resolved_type = LEGACY_MODEL_KEY_ALIASES.get(agent_type, agent_type)
        provider = self.resolved_llm_provider()
        burst_agents = {a.strip() for a in self.llm_burst_agents.split(",") if a.strip()}
        burst_lookup = {LEGACY_MODEL_KEY_ALIASES.get(a, a) for a in burst_agents}
        burst_lookup |= burst_agents
        if resolved_type in burst_lookup and self.openai_api_key.strip():
            return self.OPENAI_AGENT_MODELS.get(resolved_type, self.openai_model)

        if self.llm_profile.strip().lower() == "lean":
            single = (
                self.llm_single_model.strip()
                or os.getenv("OLLAMA_CHAT_MODEL", "").strip()
                or self.ollama_default_model
            )
            return single

        defaults = self.OPENAI_AGENT_MODELS if provider == "openai" else self.OLLAMA_AGENT_MODELS
        fallback = self.openai_model if provider == "openai" else self.ollama_default_model

        for key in (agent_type, resolved_type):
            env_keys = AGENT_ENV_KEYS.get(key)
            if env_keys:
                ollama_key, openai_key = env_keys
                override = os.getenv(openai_key if provider == "openai" else ollama_key)
                if override:
                    return override

        return defaults.get(resolved_type) or defaults.get(agent_type, fallback)

    @property
    def neo4j_enabled(self) -> bool:
        if self.deployment_profile.strip().lower() == "minimal":
            return False
        return self.enable_neo4j

    @property
    def redis_workers_enabled(self) -> bool:
        if self.deployment_profile.strip().lower() == "minimal":
            return False
        return self.enable_redis_workers

    @property
    def external_crm_sync_enabled(self) -> bool:
        if self.deployment_profile.strip().lower() == "minimal":
            return False
        return self.enable_external_crm_sync

    def is_lean_profile(self) -> bool:
        return self.llm_profile.strip().lower() == "lean"

    def get_all_agent_models(self) -> dict[str, str]:
        keys = set(self.OLLAMA_AGENT_MODELS) | set(self.OPENAI_AGENT_MODELS)
        return {agent: self.get_agent_model(agent) for agent in keys}

    def mcp_context_providers_list(self) -> list[str]:
        return [p.strip() for p in self.mcp_context_providers.split(",") if p.strip()]

    def mcp_servers_list(self) -> list[dict]:
        import json

        raw = self.mcp_servers.strip()
        if not raw:
            return []
        try:
            data = json.loads(raw)
            return data if isinstance(data, list) else []
        except json.JSONDecodeError:
            return []


@lru_cache
def get_settings() -> Settings:
    return Settings()
