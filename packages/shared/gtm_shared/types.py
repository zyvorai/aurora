"""Shared types and schemas for Emissary."""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional
import uuid


class TenantContext:
    """Shared tenant context passed across API, workers, and agents."""

    def __init__(
        self,
        tenant_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        role: str = "viewer",
        plan: str = "starter",
    ):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.role = role
        self.plan = plan


class AgentTaskType(str, Enum):
    DISCOVERY = "discovery"
    MARKETING = "marketing"
    SALES = "sales"
    CONTENT = "content"
    OUTREACH = "outreach"
    SOLUTION = "solution"
    PROPOSAL = "proposal"
    ANALYTICS = "analytics"
    LEARNING = "learning"


@dataclass
class AgentTask:
    task_id: str
    task_type: AgentTaskType
    tenant_id: str
    product_id: str
    input_data: dict
    thread_id: str


@dataclass
class JobEnvelope:
    job_id: str
    job_type: str
    tenant_id: str
    payload: dict
    idempotency_key: Optional[str] = None


EVENT_TYPES = [
    "page_view",
    "content_view",
    "query",
    "ungrounded_blocked",
    "approval_decision",
    "lead_stage",
    "chat_message",
    "ingest_complete",
    "agent_run",
]
