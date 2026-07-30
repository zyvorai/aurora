"""Pydantic schemas for API requests and responses."""

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, HttpUrl


# Auth
class RegisterRequest(BaseModel):
    tenant_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    role: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    tenant_id: uuid.UUID

    model_config = {"from_attributes": True}


# Products
class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    website_url: Optional[str] = None
    description: Optional[str] = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    website_url: Optional[str]
    description: Optional[str]
    profile: Optional[dict]
    profile_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SourceCreate(BaseModel):
    source_type: str
    url: str


class SourceResponse(BaseModel):
    id: uuid.UUID
    source_type: str
    url: str
    status: str
    pages_discovered: int
    pages_processed: int
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class IngestRequest(BaseModel):
    source_ids: Optional[list[uuid.UUID]] = None


class IngestResponse(BaseModel):
    job_id: str
    status: str
    message: str


class ProductProfile(BaseModel):
    summary: Optional[str] = None
    features: list[str] = []
    technical_stack: list[str] = []
    industry: Optional[str] = None
    target_personas: list[str] = []
    competitors: list[str] = []
    pricing: Optional[str] = None
    faqs: list[dict] = []
    architecture: Optional[str] = None
    use_cases: list[str] = []
    pain_points: list[str] = []
    roi_statements: list[str] = []
    value_propositions: list[str] = []
    field_status: dict[str, str] = {}


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    session_id: Optional[str] = None


class Citation(BaseModel):
    chunk_id: str
    document_title: str
    excerpt: str
    url: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    confidence: float
    grounded: bool


# Marketing Strategy
class StrategyRequest(BaseModel):
    focus_areas: list[str] = []


class StrategyResponse(BaseModel):
    artifact_id: uuid.UUID
    gtm_strategy: str
    icp: str
    personas: list[dict]
    positioning: str
    messaging_hierarchy: dict
    value_propositions: list[str]
    objection_handling: list[dict]
    competitive_comparison: list[dict]
    seo_keywords: list[str]
    content_calendar: list[dict]
    citations: list[Citation]


# Content
class ContentRequest(BaseModel):
    content_type: str = Field(..., description="linkedin, blog, email, x_thread, etc.")
    topic: str
    tone: str = "professional"
    target_persona: Optional[str] = None


class ContentResponse(BaseModel):
    artifact_id: uuid.UUID
    title: str
    content: str
    citations: list[Citation]
    grounded: bool
    status: str


class ApprovalRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    comment: Optional[str] = None


class ApprovalResponse(BaseModel):
    id: uuid.UUID
    artifact_id: uuid.UUID
    status: str
    reviewer_id: Optional[uuid.UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


# Sales Chat
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str


class ChatResponse(BaseModel):
    reply: str
    citations: list[Citation]
    grounded: bool
    lead_score: Optional[float] = None
    suggested_actions: list[str] = []


# Outreach
class OutreachRequest(BaseModel):
    company_url: str
    target_persona: str = "CTO"
    campaign_name: Optional[str] = None


class OutreachResponse(BaseModel):
    artifact_id: uuid.UUID
    company_name: str
    company_analysis: dict
    pain_points: list[str]
    product_fit: str
    email_draft: str
    follow_up_sequence: list[dict]
    citations: list[Citation]


# Publishing
class PublishRequest(BaseModel):
    artifact_id: uuid.UUID
    channel: str
    scheduled_at: Optional[datetime] = None


class PublishResponse(BaseModel):
    channel_post_id: uuid.UUID
    status: str
    idempotency_key: str


# Solution Architect
class ArchitectRequest(BaseModel):
    question: str
    context: Optional[str] = None


class ArchitectResponse(BaseModel):
    answer: str
    architecture_diagram: Optional[str]
    deployment_plan: Optional[str]
    citations: list[Citation]
    grounded: bool


# Proposals
class ProposalRequest(BaseModel):
    lead_id: Optional[uuid.UUID] = None
    scope: str
    include_pricing: bool = True


class ProposalResponse(BaseModel):
    artifact_id: uuid.UUID
    title: str
    proposal_content: str
    sow: str
    roi_analysis: str
    pricing: Optional[str]
    timeline: str
    citations: list[Citation]


# Analytics
class AnalyticsResponse(BaseModel):
    period: str
    metrics: dict[str, Any]
    funnel: dict[str, int]
    top_questions: list[dict]
    knowledge_gaps: list[dict]


# Generic
class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None
