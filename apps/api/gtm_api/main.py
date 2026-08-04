"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import APIConnectionError, APIError as OpenAIAPIError
from sqlalchemy.exc import OperationalError

from gtm_api.config import get_settings
from gtm_api.database import DB_SETUP_HINT, check_database
from gtm_api.routers import auth, products, marketing, agents, workflows, pipeline, crm, success, mcp
from gtm_api.services.embeddings import LLMServiceError
from gtm_api.services.llm import check_llm_health

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from gtm_api.services.vector_store import vector_store
    from gtm_api.services.knowledge_graph import knowledge_graph

    app.state.llm_health = {}
    app.state.db_health = await check_database()
    if not app.state.db_health.get("db_ready"):
        print(f"WARNING: {app.state.db_health.get('db_message')}")

    try:
        await vector_store.ensure_collection()
        if settings.neo4j_enabled:
            await knowledge_graph.ensure_constraints()
    except Exception:
        pass
    try:
        app.state.llm_health = await check_llm_health()
    except Exception as exc:
        app.state.llm_health = {"llm_ready": False, "message": str(exc)}

    yield
    if settings.neo4j_enabled:
        try:
            await knowledge_graph.close()
        except Exception:
            pass


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ConnectionRefusedError)
async def connection_refused_handler(_request: Request, _exc: ConnectionRefusedError):
    return JSONResponse(status_code=503, content={"detail": DB_SETUP_HINT})


@app.exception_handler(OperationalError)
async def db_operational_error_handler(_request: Request, _exc: OperationalError):
    return JSONResponse(status_code=503, content={"detail": DB_SETUP_HINT})


@app.exception_handler(LLMServiceError)
async def llm_service_error_handler(_request: Request, exc: LLMServiceError):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.exception_handler(APIConnectionError)
async def openai_connection_error_handler(_request: Request, _exc: APIConnectionError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Cannot reach the LLM provider. For Ollama, run `ollama serve` and check "
                "http://127.0.0.1:11434/api/tags"
            ),
        },
    )


@app.exception_handler(OpenAIAPIError)
async def openai_api_error_handler(_request: Request, exc: OpenAIAPIError):
    message = str(exc)
    if "signal: killed" in message.lower():
        message = (
            "Ollama ran out of memory loading the chat model. "
            "Try a smaller model (e.g. AGENT_MODEL_PRODUCT_UNDERSTANDING=llama3.1:8b) or free RAM, then retry."
        )
    elif "exceed_context_size" in message or "context size" in message.lower():
        message = (
            "Prompt exceeds the model context window. "
            "Set OLLAMA_NUM_CTX=8192 in .env (or higher if RAM allows) and restart the API."
        )
    return JSONResponse(status_code=503, content={"detail": message})


app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(products.router, prefix=settings.api_prefix)
app.include_router(marketing.router, prefix=settings.api_prefix)
app.include_router(agents.router, prefix=settings.api_prefix)
app.include_router(workflows.router, prefix=settings.api_prefix)
app.include_router(pipeline.router, prefix=settings.api_prefix)
app.include_router(crm.router, prefix=settings.api_prefix)
app.include_router(success.router, prefix=settings.api_prefix)
app.include_router(mcp.router, prefix=settings.api_prefix)


@app.get("/health")
async def health():
    db_health = await check_database()
    llm_health = await check_llm_health()
    db_ready = db_health.get("db_ready", False)
    llm_ready = llm_health.get("llm_ready", False)
    llm_core_ready = llm_health.get("llm_core_ready", llm_ready)
    status = "healthy" if db_ready and llm_core_ready else "degraded"
    return {
        "status": status,
        "service": settings.app_name,
        **db_health,
        **llm_health,
    }
