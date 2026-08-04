"""Dual-provider LLM factory (Ollama + OpenAI)."""

import httpx
from langchain_openai import ChatOpenAI

from gtm_api.config import get_settings

AGENT_TYPES = [
    "product_understanding",
    "marketing_strategy",
    "content_studio",
    "sales_agent",
    "outreach",
    "solution_architect",
    "proposal_generator",
]

# Agents required for the default Forge workflow (ingest → profile → strategy → chat).
CORE_AGENT_TYPES = [
    "product_understanding",
    "marketing_strategy",
    "content_studio",
    "sales_agent",
    "solution_architect",
    "proposal_generator",
]


def _ollama_model_available(configured: str, available: list[str]) -> bool:
    if not configured:
        return True
    base = configured.split(":")[0]
    return any(
        name == configured or name.split(":")[0] == base or base in name
        for name in available
    )


def _missing_ollama_models(required: set[str], available: list[str]) -> list[str]:
    return sorted(
        model
        for model in required
        if model and not _ollama_model_available(model, available)
    )


def get_provider() -> str:
    return get_settings().resolved_llm_provider()


def get_chat_model(agent_type: str, temperature: float = 0.2) -> ChatOpenAI:
    settings = get_settings()
    model = settings.get_agent_model(agent_type)
    kwargs: dict = {
        "model": model,
        "api_key": settings.llm_api_key,
        "base_url": settings.llm_base_url,
        "temperature": temperature,
    }
    if settings.resolved_llm_provider() == "ollama":
        kwargs["extra_body"] = {"options": {"num_ctx": settings.ollama_num_ctx}}
    return ChatOpenAI(**kwargs)


async def check_ollama_health(base_url: str) -> tuple[bool, list[str]]:
    tags_url = base_url.replace("/v1", "").rstrip("/") + "/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(tags_url)
            if response.status_code != 200:
                return False, []
            data = response.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            return True, models
    except Exception:
        return False, []


async def check_llm_health() -> dict:
    settings = get_settings()
    provider = settings.resolved_llm_provider()
    configured_models = settings.get_all_agent_models()

    if provider == "openai":
        ready = bool(settings.openai_api_key.strip())
        return {
            "llm_provider": provider,
            "llm_profile": settings.llm_profile,
            "deployment_profile": settings.deployment_profile,
            "llm_ready": ready,
            "llm_core_ready": ready,
            "chat_models": configured_models,
            "embedding_model": settings.embedding_model,
            "embedding_dimensions": settings.embedding_dimensions,
            "available_models": ["openai-managed"] if ready else [],
            "missing_models": [],
            "core_missing_models": [],
            "message": None if ready else "OPENAI_API_KEY is not set",
        }

    ready, available = await check_ollama_health(settings.ollama_base_url)
    if settings.is_lean_profile():
        chat_model = settings.get_agent_model("product_understanding")
        required = {chat_model, settings.ollama_embedding_model}
        core_required = required
    else:
        required = set(configured_models.values()) | {settings.ollama_embedding_model}
        core_required = (
            {configured_models[a] for a in CORE_AGENT_TYPES if a in configured_models}
            | {settings.ollama_embedding_model}
        )
    missing = _missing_ollama_models(required, available)
    core_missing = _missing_ollama_models(core_required, available)
    fully_ready = ready and not missing
    core_ready = ready and not core_missing
    message = None
    if not ready:
        message = "Ollama is not reachable at " + settings.ollama_base_url
    elif missing:
        message = (
            f"Missing Ollama models: {', '.join(missing)}. "
            "Run: make ollama-pull"
        )
    return {
        "llm_provider": provider,
        "llm_profile": settings.llm_profile,
        "deployment_profile": settings.deployment_profile,
        "llm_ready": fully_ready,
        "llm_core_ready": core_ready,
        "llm_reachable": ready,
        "chat_models": configured_models,
        "embedding_model": settings.embedding_model,
        "embedding_dimensions": settings.embedding_dimensions,
        "available_models": available,
        "missing_models": missing,
        "core_missing_models": core_missing,
        "message": message,
    }
