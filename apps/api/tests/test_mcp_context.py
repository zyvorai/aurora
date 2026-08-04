"""Tests for MCP context hub."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from gtm_api.services.mcp.context_hub import gather_decision_context, list_available_providers
from gtm_api.services.mcp.types import ContextBlock, DecisionContext


def test_decision_context_prompt_section():
    ctx = DecisionContext(
        query="How does auth work?",
        blocks=[
            ContextBlock(
                source="internal",
                provider="rag",
                title="Docs",
                content="Auth uses OAuth2.",
            ),
            ContextBlock(
                source="internal",
                provider="crm",
                title="Pipeline",
                content="3 open deals.",
            ),
        ],
    )
    prompt = ctx.to_prompt_section()
    assert "Product documentation" in prompt or "Docs" in prompt
    assert "CRM pipeline" in prompt or "Pipeline" in prompt
    assert ctx.sources_used == ["rag", "crm"]


def test_list_available_providers_includes_internal():
    providers = list_available_providers()
    ids = {p["id"] for p in providers}
    assert "rag" in ids
    assert "profile" in ids
    assert "crm" in ids


@pytest.mark.asyncio
async def test_gather_decision_context_disabled_falls_back_to_rag(monkeypatch):
    monkeypatch.setenv("MCP_CONTEXT_ENABLED", "false")
    from gtm_api.config import get_settings

    get_settings.cache_clear()

    fake_block = ContextBlock(
        source="internal",
        provider="rag",
        title="Docs",
        content="chunk text",
    )

    with patch(
        "gtm_api.services.mcp.context_hub.provider_rag",
        new=AsyncMock(return_value=(fake_block, [])),
    ):
        ctx = await gather_decision_context(
            "test question",
            uuid.uuid4(),
            uuid.uuid4(),
        )

    assert len(ctx.blocks) == 1
    assert ctx.blocks[0].provider == "rag"
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_gather_decision_context_aggregates_providers(monkeypatch):
    monkeypatch.setenv("MCP_CONTEXT_ENABLED", "true")
    monkeypatch.setenv("MCP_CONTEXT_PROVIDERS", "rag,profile")
    monkeypatch.setenv("MCP_EXTERNAL_ENABLED", "false")
    from gtm_api.config import get_settings

    get_settings.cache_clear()

    rag_block = ContextBlock(source="internal", provider="rag", title="RAG", content="docs")
    profile_block = ContextBlock(
        source="internal", provider="profile", title="Profile", content="{}"
    )

    with (
        patch(
            "gtm_api.services.mcp.context_hub.provider_rag",
            new=AsyncMock(return_value=(rag_block, [])),
        ),
        patch(
            "gtm_api.services.mcp.context_hub.provider_profile",
            new=AsyncMock(return_value=profile_block),
        ),
        patch(
            "gtm_api.services.mcp.context_hub._collect_blocks",
            new=AsyncMock(
                return_value=DecisionContext(
                    query="q",
                    blocks=[rag_block, profile_block],
                )
            ),
        ),
    ):
        ctx = await gather_decision_context("q", uuid.uuid4(), uuid.uuid4(), db=AsyncMock())

    assert set(ctx.sources_used) == {"rag", "profile"}
    get_settings.cache_clear()
