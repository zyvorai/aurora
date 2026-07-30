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


def get_provider() -> str:
    return get_settings().resolved_llm_provider()


def get_chat_model(agent_type: str, temperature: float = 0.2) -> ChatOpenAI:
    settings = get_settings()
    model = settings.get_agent_model(agent_type)
    return ChatOpenAI(
        model=model,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        temperature=temperature,
    )


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
            "llm_ready": ready,
            "chat_models": configured_models,
            "embedding_model": settings.embedding_model,
            "embedding_dimensions": settings.embedding_dimensions,
            "available_models": ["openai-managed"] if ready else [],
            "message": None if ready else "OPENAI_API_KEY is not set",
        }

    ready, available = await check_ollama_health(settings.ollama_base_url)
    required = set(configured_models.values()) | {settings.ollama_embedding_model}
    missing = [
        model
        for model in required
        if model and not any(model.split(":")[0] in a for a in available)
    ]
    fully_ready = ready and not missing
    message = None
    if not ready:
        message = "Ollama is not reachable at " + settings.ollama_base_url
    elif missing:
        message = (
            f"Missing Ollama models: {', '.join(sorted(missing))}. "
            "Run: make ollama-pull"
        )
    return {
        "llm_provider": provider,
        "llm_ready": fully_ready,
        "llm_reachable": ready,
        "chat_models": configured_models,
        "embedding_model": settings.embedding_model,
        "embedding_dimensions": settings.embedding_dimensions,
        "available_models": available,
        "missing_models": missing,
        "message": message,
    }
