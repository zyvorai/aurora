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


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    role: str = Field(default="viewer")


class ApiKeyCreatedResponse(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    key_prefix: str
    api_key: str  # shown once, at creation time only


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    key_prefix: str
    last_used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# External portals (customer/salesperson/reseller — customer only for now)
class PortalSignupRequest(BaseModel):
    tenant_slug: str = Field(..., min_length=1, max_length=100)
    product_id: uuid.UUID
    email: EmailStr
    password: str = Field(..., min_length=8)
    company_name: str = ""
    contact_name: str = ""


class PortalSignupResponse(BaseModel):
    id: uuid.UUID
    status: str
    message: str = "Signup received. An administrator will review your request."


class PortalLoginRequest(BaseModel):
    tenant_slug: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str


class PortalTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    portal_type: str = "customer"
    account_id: uuid.UUID
    tenant_id: uuid.UUID


class CustomerAccountResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    product_id: uuid.UUID
    email: str
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    status: str
    rejected_reason: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerProfileUpdateRequest(BaseModel):
    """Self-service profile edit -- deliberately excludes email/status/product_id/
    tenant_id, which only an admin (via the approve/reject endpoints) may change."""

    company_name: Optional[str] = Field(None, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)


class PortalRejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=1000)


class DocumentUploadResponse(BaseModel):
    proof_document_key: str


class DocumentDownloadUrlResponse(BaseModel):
    url: str


class TicketCreateRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=10000)
    priority: str = Field("medium", pattern="^(low|medium|high|urgent)$")


class TicketStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(open|in_progress|resolved|closed)$")


class TicketResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    customer_account_id: uuid.UUID
    subject: str
    description: str
    status: str
    priority: str
    resolved_by: Optional[uuid.UUID] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketWithCustomerResponse(TicketResponse):
    """Admin-facing list view -- includes enough of the reporting customer's identity
    to triage without a second lookup."""

    customer_email: str
    customer_company_name: Optional[str] = None


class ResellerSignupRequest(BaseModel):
    tenant_slug: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    company_name: str = ""
    contact_name: str = ""
    business_id: str = ""


class ResellerAccountResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    business_id: Optional[str] = None
    margin_tier: str = "standard"
    authorized_product_ids: Optional[list[uuid.UUID]] = None
    proof_document_key: Optional[str] = None
    status: str
    rejected_reason: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ResellerProfileUpdateRequest(BaseModel):
    """Self-service profile edit -- excludes email/status/margin_tier/
    authorized_product_ids, which only an admin may change."""

    company_name: Optional[str] = Field(None, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)


class DealRegistrationRequest(BaseModel):
    product_id: uuid.UUID
    company_name: str = Field(..., min_length=1, max_length=255)
    domain: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    geo: Optional[str] = None


class DealRegistrationResponse(BaseModel):
    id: uuid.UUID
    company_name: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SalesPersonSignupRequest(BaseModel):
    tenant_slug: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    contact_name: str = ""
    territory: str = ""


class SalesPersonAccountResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    contact_name: Optional[str] = None
    commission_rate: float = 0.0
    territory: Optional[str] = None
    proof_document_key: Optional[str] = None
    status: str
    rejected_reason: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SalesPersonProfileUpdateRequest(BaseModel):
    """Self-service profile edit -- excludes email/status/commission_rate, which only
    an admin may change."""

    contact_name: Optional[str] = Field(None, max_length=255)
    territory: Optional[str] = Field(None, max_length=255)


class SalesPersonLeadResponse(BaseModel):
    id: uuid.UUID
    company: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    title: Optional[str] = None
    score: float = 0.0
    stage: str
    created_at: datetime

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
    url: Optional[str] = None
    display_name: Optional[str] = None
    metadata: Optional[dict] = None
    github_token: Optional[str] = None


class DatabaseSourceCreate(BaseModel):
    engine: str = Field(..., pattern="^(postgresql|mysql|mariadb)$")
    host: str
    port: Optional[int] = None
    database: str
    username: str
    password: str
    tables: list[str] = Field(..., min_length=1)
    display_name: Optional[str] = None
    read_only: bool = True


class DatabaseTestRequest(BaseModel):
    engine: str = Field(..., pattern="^(postgresql|mysql|mariadb)$")
    host: str
    port: Optional[int] = None
    database: str
    username: str
    password: str


class DatabaseTestResponse(BaseModel):
    tables: list[str]


class SourceResponse(BaseModel):
    id: uuid.UUID
    source_type: str
    url: Optional[str]
    display_name: Optional[str]
    storage_key: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    status: str
    pages_discovered: int
    pages_processed: int
    error_message: Optional[str]
    metadata: Optional[dict] = None
    last_crawled_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_source(cls, source) -> "SourceResponse":
        return cls(
            id=source.id,
            source_type=source.source_type.value,
            url=source.url,
            display_name=source.display_name,
            storage_key=source.storage_key,
            mime_type=source.mime_type,
            file_size_bytes=source.file_size_bytes,
            status=source.status.value,
            pages_discovered=source.pages_discovered,
            pages_processed=source.pages_processed,
            error_message=source.error_message,
            metadata=source.metadata_ or {},
            last_crawled_at=source.last_crawled_at,
            created_at=source.created_at,
        )


class IngestRequest(BaseModel):
    source_ids: Optional[list[uuid.UUID]] = None
    force: bool = False
    async_mode: bool = True


class IngestResponse(BaseModel):
    job_ids: list[str] = []
    status: str
    message: str
    sources_queued: int = 0
    results: Optional[list[dict]] = None


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
    sources_used: list[str] = []


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
    sources_used: list[str] = []


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
    sources_used: list[str] = []


# Outreach
class OutreachRequest(BaseModel):
    company_url: str
    target_persona: str = "CTO"
    campaign_name: Optional[str] = None
    recipient_email: Optional[str] = None


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
    recipient: Optional[str] = None


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
    sources_used: list[str] = []


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
    sources_used: list[str] = []


# Analytics
class AnalyticsResponse(BaseModel):
    period: str
    metrics: dict[str, Any]
    funnel: dict[str, int]
    top_questions: list[dict]
    knowledge_gaps: list[dict]


# Executive brief (Tier 0 — no LLM)
class GtmReadiness(BaseModel):
    ingest_started: bool
    ingest_complete: bool
    profile_built: bool
    strategy_ready: bool
    outreach_ready: bool
    discover_ready: bool
    qualify_ready: bool
    proposal_ready: bool
    publish_ready: bool


class BriefKpis(BaseModel):
    leads: int
    conversations: int
    artifacts: int
    agent_runs: int


class BriefResponse(BaseModel):
    product_id: uuid.UUID
    product_name: str
    profile_status: str
    gtm_readiness: GtmReadiness
    kpis: BriefKpis
    funnel: dict[str, int]
    metrics: dict[str, Any]
    narrative: str
    risks: list[str]
    updated_at: str
    compute_tier: str = "T0"
    narrative_llm: Optional[str] = None


# Workflows
class OutboundSprintRequest(BaseModel):
    focus_industries: list[str] = Field(default_factory=list)
    max_leads: int = 50
    campaign_name: Optional[str] = None
    company_url: Optional[str] = None
    target_persona: str = "CTO"


# Pipeline (Wave 2)
class MarketResearchRequest(BaseModel):
    focus_industries: list[str] = Field(default_factory=list)


class MarketResearchResponse(BaseModel):
    artifact_id: uuid.UUID
    brief: dict[str, Any]
    tokens_used: int = 0


class DiscoverLeadsRequest(BaseModel):
    focus_industries: list[str] = Field(default_factory=list)
    max_leads: int = 50
    csv_import: Optional[str] = None
    geo: Optional[str] = None


class DiscoverLeadsResponse(BaseModel):
    discovered_count: int
    industries_used: list[str]
    accounts: list[dict[str, Any]]


class QualifyLeadsRequest(BaseModel):
    account_ids: Optional[list[uuid.UUID]] = None
    focus_industries: list[str] = Field(default_factory=list)


class QualifyLeadsResponse(BaseModel):
    qualified_count: int
    tier_a: int
    tier_b: int
    leads: list[dict[str, Any]]


class PipelineLeadResponse(BaseModel):
    account_id: str
    company_name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    score: float = 0
    tier: str = "C"
    explanation: Optional[str] = None
    factors: dict[str, Any] = Field(default_factory=dict)
    score_id: Optional[str] = None


class CampaignCreateRequest(BaseModel):
    name: str
    campaign_type: str = "outreach"
    template: str = "outbound_sprint"
    channels: list[str] = Field(default_factory=lambda: ["email"])
    focus_industries: list[str] = Field(default_factory=list)


class CampaignResponse(BaseModel):
    id: uuid.UUID
    name: str
    campaign_type: str
    status: str
    config: dict[str, Any] = Field(default_factory=dict)


# CRM (Wave 3)
class OpportunityCreateRequest(BaseModel):
    name: str
    company: Optional[str] = None
    stage: str = "discovery"
    lead_id: Optional[uuid.UUID] = None
    amount: Optional[float] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class OpportunityStageUpdate(BaseModel):
    stage: str


class OpportunityResponse(BaseModel):
    id: uuid.UUID
    name: str
    company: Optional[str] = None
    stage: str
    amount: Optional[float] = None
    probability: float = 0.1
    lead_id: Optional[uuid.UUID] = None
    proposal_artifact_id: Optional[uuid.UUID] = None
    architect_artifact_id: Optional[uuid.UUID] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SalesPersonPipelineResponse(BaseModel):
    leads: list[SalesPersonLeadResponse]
    opportunities: list[OpportunityResponse]


class SalesPersonActivityResponse(BaseModel):
    """Admin-facing overview row: one sales rep plus everything currently assigned to
    them, so an admin can see who's working which client at what stage without
    cross-referencing the Leads/Opportunities tables by hand."""

    salesperson: SalesPersonAccountResponse
    leads: list[SalesPersonLeadResponse]
    opportunities: list[OpportunityResponse]


class PipelineSummaryResponse(BaseModel):
    total: int
    by_stage: dict[str, int]
    weighted_pipeline: float


# Workflows (Wave 3)
class TechnicalEvalRequest(BaseModel):
    opportunity_name: str
    company: Optional[str] = None
    question: str
    scope: str
    lead_id: Optional[uuid.UUID] = None
    include_pricing: bool = True


class GenerateProposalRequest(BaseModel):
    scope: str
    include_pricing: bool = True
    opportunity_id: Optional[uuid.UUID] = None


class WorkflowStepStatus(BaseModel):
    name: str
    status: str
    updated_at: Optional[str] = None
    error: Optional[str] = None


class WorkflowRunAccepted(BaseModel):
    workflow_run_id: uuid.UUID
    status: str
    poll_url: str


class WorkflowRunResponse(BaseModel):
    id: uuid.UUID
    workflow_name: str
    status: str
    steps: list[WorkflowStepStatus]
    output_data: dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


# Success & insights (Wave 4)
class PipelineMetrics(BaseModel):
    by_stage: dict[str, int] = Field(default_factory=dict)
    total_opportunities: int = 0
    weighted_value: float = 0.0


class CampaignMetrics(BaseModel):
    total: int = 0
    active: int = 0


class InsightsResponse(BaseModel):
    period: str
    metrics: dict[str, Any] = Field(default_factory=dict)
    funnel: dict[str, int] = Field(default_factory=dict)
    top_questions: list[dict] = Field(default_factory=list)
    knowledge_gaps: list[dict] = Field(default_factory=list)
    pipeline: PipelineMetrics = Field(default_factory=PipelineMetrics)
    campaigns: CampaignMetrics = Field(default_factory=CampaignMetrics)
    compute_tier: str = "T0"
    narrative_llm: Optional[str] = None
    narrative_fresh: bool = False
    narrative_updated_at: Optional[str] = None


class AccountHealthResponse(BaseModel):
    id: str
    opportunity_id: str
    health_score: float
    status: str
    metrics: dict[str, Any] = Field(default_factory=dict)
    playbook: dict[str, Any] = Field(default_factory=dict)
    cs_brief: dict[str, Any] = Field(default_factory=dict)
    last_cs_brief_at: Optional[str] = None
    updated_at: Optional[str] = None


class SuccessPlanResponse(BaseModel):
    opportunity_id: str
    health_score: float
    status: str
    playbook: dict[str, Any] = Field(default_factory=dict)
    cs_brief: dict[str, Any] = Field(default_factory=dict)


class SyncStatusResponse(BaseModel):
    enabled: bool
    provider: Optional[str] = None
    deployment_profile: str = "full"


# Admin (Phase 12)
class AdminPlanResponse(BaseModel):
    plan: str
    tenant_slug: str
    features: dict[str, Any]
    usage: dict[str, int]


class SuppressionEntryResponse(BaseModel):
    id: uuid.UUID
    email: str
    reason: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AddSuppressionRequest(BaseModel):
    email: str
    reason: str = "opt_out"


class PurgeRequest(BaseModel):
    confirm: str


class PurgeResponse(BaseModel):
    status: str
    tenant_id: str


# Custom workflow stages (tenant-defined Full Forge sidebar stages)
class WorkflowStageResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    group_label: str
    label: str
    icon: str
    tone: str
    position: int
    content_blocks: list[dict[str, Any]]
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowStageCreateRequest(BaseModel):
    group_label: str = Field(..., min_length=1, max_length=100)
    label: str = Field(..., min_length=1, max_length=100)
    icon: str = Field(..., max_length=50)
    tone: str = Field(..., max_length=20)
    position: int = 0
    content_blocks: list[dict[str, Any]] = Field(default_factory=list)


class WorkflowStageUpdateRequest(BaseModel):
    group_label: Optional[str] = Field(None, min_length=1, max_length=100)
    label: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    tone: Optional[str] = Field(None, max_length=20)
    position: Optional[int] = None
    content_blocks: Optional[list[dict[str, Any]]] = None


# Generic
class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None
