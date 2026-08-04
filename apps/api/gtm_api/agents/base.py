"""Shared agent contract for composable GTM agents."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal


class ComputeTier(str, Enum):
    T0 = "T0"  # deterministic — no LLM
    T1 = "T1"  # cached / template
    T2 = "T2"  # light LLM
    T3 = "T3"  # cloud burst


AgentStatus = Literal["completed", "failed", "needs_input", "not_implemented"]


@dataclass
class AgentInput:
    tenant_id: uuid.UUID
    product_id: uuid.UUID
    user_id: uuid.UUID
    request_type: str
    payload: dict = field(default_factory=dict)
    upstream_artifacts: dict = field(default_factory=dict)


@dataclass
class AgentOutput:
    agent_id: str
    status: AgentStatus
    artifacts: dict = field(default_factory=dict)
    citations: list = field(default_factory=list)
    tokens_used: int = 0
    next_suggested_agents: list[str] = field(default_factory=list)
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "status": self.status,
            "artifacts": self.artifacts,
            "citations": self.citations,
            "tokens_used": self.tokens_used,
            "next_suggested_agents": self.next_suggested_agents,
            "error": self.error,
        }


def wrap_llm_error(agent_id: str, exc: Exception) -> AgentOutput:
    message = str(exc)
    if "signal: killed" in message.lower():
        message = (
            "LLM ran out of memory. Use LLM_PROFILE=lean or a smaller model, then retry."
        )
    elif "exceed_context_size" in message or "context size" in message.lower():
        message = "Prompt exceeds model context window. Reduce input size or raise OLLAMA_NUM_CTX."
    return AgentOutput(agent_id=agent_id, status="failed", error=message)
