"""Pydantic schemas for API requests and responses."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


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
    last_used_at: datetime | None = None
    revoked_at: datetime | None = None
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
    company_name: str | None = None
    contact_name: str | None = None
    status: str
    rejected_reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerProfileUpdateRequest(BaseModel):
    """Self-service profile edit -- deliberately excludes email/status/product_id/
    tenant_id, which only an admin (via the approve/reject endpoints) may change."""

    company_name: str | None = Field(None, max_length=255)
    contact_name: str | None = Field(None, max_length=255)


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
    resolved_by: uuid.UUID | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketWithCustomerResponse(TicketResponse):
    """Admin-facing list view -- includes enough of the reporting customer's identity
    to triage without a second lookup."""

    customer_email: str
    customer_company_name: str | None = None


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
    company_name: str | None = None
    contact_name: str | None = None
    business_id: str | None = None
    margin_tier: str = "standard"
    authorized_product_ids: list[uuid.UUID] | None = None
    proof_document_key: str | None = None
    status: str
    rejected_reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ResellerProfileUpdateRequest(BaseModel):
    """Self-service profile edit -- excludes email/status/margin_tier/
    authorized_product_ids, which only an admin may change."""

    company_name: str | None = Field(None, max_length=255)
    contact_name: str | None = Field(None, max_length=255)


class DealRegistrationRequest(BaseModel):
    product_id: uuid.UUID
    company_name: str = Field(..., min_length=1, max_length=255)
    domain: str | None = None
    industry: str | None = None
    company_size: str | None = None
    geo: str | None = None


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
    contact_name: str | None = None
    commission_rate: float = 0.0
    territory: str | None = None
    proof_document_key: str | None = None
    status: str
    rejected_reason: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SalesPersonProfileUpdateRequest(BaseModel):
    """Self-service profile edit -- excludes email/status/commission_rate, which only
    an admin may change."""

    contact_name: str | None = Field(None, max_length=255)
    territory: str | None = Field(None, max_length=255)


class SalesPersonLeadResponse(BaseModel):
    id: uuid.UUID
    company: str | None = None
    name: str | None = None
    email: str | None = None
    title: str | None = None
    score: float = 0.0
    stage: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Products
class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    website_url: str | None = None
    description: str | None = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    website_url: str | None
    description: str | None
    profile: dict | None
    profile_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SourceCreate(BaseModel):
    source_type: str
    url: str | None = None
    display_name: str | None = None
    metadata: dict | None = None
    github_token: str | None = None


class DatabaseSourceCreate(BaseModel):
    engine: str = Field(..., pattern="^(postgresql|mysql|mariadb)$")
    host: str
    port: int | None = None
    database: str
    username: str
    password: str
    tables: list[str] = Field(..., min_length=1)
    display_name: str | None = None
    read_only: bool = True


class DatabaseTestRequest(BaseModel):
    engine: str = Field(..., pattern="^(postgresql|mysql|mariadb)$")
    host: str
    port: int | None = None
    database: str
    username: str
    password: str


class DatabaseTestResponse(BaseModel):
    tables: list[str]


class SourceResponse(BaseModel):
    id: uuid.UUID
    source_type: str
    url: str | None
    display_name: str | None
    storage_key: str | None = None
    mime_type: str | None = None
    file_size_bytes: int | None = None
    status: str
    pages_discovered: int
    pages_processed: int
    error_message: str | None
    metadata: dict | None = None
    last_crawled_at: datetime | None = None
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
    source_ids: list[uuid.UUID] | None = None
    force: bool = False
    async_mode: bool = True


class IngestResponse(BaseModel):
    job_ids: list[str] = []
    status: str
    message: str
    sources_queued: int = 0
    results: list[dict] | None = None


class ProductProfile(BaseModel):
    summary: str | None = None
    features: list[str] = []
    technical_stack: list[str] = []
    industry: str | None = None
    target_personas: list[str] = []
    competitors: list[str] = []
    pricing: str | None = None
    faqs: list[dict] = []
    architecture: str | None = None
    use_cases: list[str] = []
    pain_points: list[str] = []
    roi_statements: list[str] = []
    value_propositions: list[str] = []
    field_status: dict[str, str] = {}


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    session_id: str | None = None


class Citation(BaseModel):
    chunk_id: str
    document_title: str
    excerpt: str
    url: str | None = None


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
    target_persona: str | None = None


class ContentResponse(BaseModel):
    artifact_id: uuid.UUID
    title: str
    content: str
    citations: list[Citation]
    grounded: bool
    status: str


class ApprovalRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    comment: str | None = None


class ApprovalResponse(BaseModel):
    id: uuid.UUID
    artifact_id: uuid.UUID
    status: str
    reviewer_id: uuid.UUID | None
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
    lead_score: float | None = None
    suggested_actions: list[str] = []
    sources_used: list[str] = []


# Outreach
class OutreachRequest(BaseModel):
    company_url: str
    target_persona: str = "CTO"
    campaign_name: str | None = None
    recipient_email: str | None = None


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
    scheduled_at: datetime | None = None
    recipient: str | None = None


class PublishResponse(BaseModel):
    channel_post_id: uuid.UUID
    status: str
    idempotency_key: str


# Solution Architect
class ArchitectRequest(BaseModel):
    question: str
    context: str | None = None


class ArchitectResponse(BaseModel):
    answer: str
    architecture_diagram: str | None
    deployment_plan: str | None
    citations: list[Citation]
    grounded: bool
    sources_used: list[str] = []


# Proposals
class ProposalRequest(BaseModel):
    lead_id: uuid.UUID | None = None
    scope: str
    include_pricing: bool = True


class ProposalResponse(BaseModel):
    artifact_id: uuid.UUID
    title: str
    proposal_content: str
    sow: str
    roi_analysis: str
    pricing: str | None
    timeline: str
    citations: list[Citation]
    sources_used: list[str] = []


# Analytics
class AnalyticsResponse(BaseModel):
    period: str
    window: dict[str, Any] = Field(default_factory=dict)
    metrics: dict[str, Any]
    funnel: dict[str, int]
    definitions: dict[str, str] = Field(default_factory=dict)
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
    accounts_found: int
    qualified: int


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
    narrative_llm: str | None = None


# Workflows
class OutboundSprintRequest(BaseModel):
    focus_industries: list[str] = Field(default_factory=list)
    max_leads: int = 50
    campaign_name: str | None = None
    company_url: str | None = None
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
    csv_import: str | None = None
    geo: str | None = None


class DiscoverLeadsResponse(BaseModel):
    discovered_count: int
    industries_used: list[str]
    accounts: list[dict[str, Any]]


class QualifyLeadsRequest(BaseModel):
    account_ids: list[uuid.UUID] | None = None
    focus_industries: list[str] = Field(default_factory=list)


class QualifyLeadsResponse(BaseModel):
    qualified_count: int
    tier_a: int
    tier_b: int
    leads: list[dict[str, Any]]


class PipelineLeadResponse(BaseModel):
    account_id: str
    company_name: str
    domain: str | None = None
    industry: str | None = None
    score: float = 0
    tier: str = "C"
    explanation: str | None = None
    factors: dict[str, Any] = Field(default_factory=dict)
    score_id: str | None = None


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
    company: str | None = None
    stage: str = "discovery"
    lead_id: uuid.UUID | None = None
    amount: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class OpportunityStageUpdate(BaseModel):
    stage: str


class OpportunityResponse(BaseModel):
    id: uuid.UUID
    name: str
    company: str | None = None
    stage: str
    amount: float | None = None
    probability: float = 0.1
    lead_id: uuid.UUID | None = None
    proposal_artifact_id: uuid.UUID | None = None
    architect_artifact_id: uuid.UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


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


class InboundLeadRequest(BaseModel):
    email: str
    name: str | None = None
    company: str | None = None
    phone: str | None = None
    title: str | None = None
    domain: str | None = None
    utm_source: str | None = None
    utm_campaign: str | None = None
    utm_medium: str | None = None


class InboundLeadResponse(BaseModel):
    lead_id: str
    score: float
    stage: str
    assigned_sales_person_id: str | None = None
    enrichment_provider: str
    crm_sync: dict[str, Any] = Field(default_factory=dict)


class PublicInboundLeadRequest(InboundLeadRequest):
    product_id: str
    embed_key: str


class InboundEmbedConfigResponse(BaseModel):
    product_id: str
    product_name: str
    embed_key: str
    form_fields: list[str] = Field(default_factory=list)


class SequenceStepInput(BaseModel):
    day: int = 3
    subject: str = ""
    body: str = ""


class UpdateSequenceRequest(BaseModel):
    recipient: str | None = None
    steps: list[SequenceStepInput] = Field(default_factory=list)


class UpdateSequenceResponse(BaseModel):
    parent_artifact_id: str
    steps: int


class SequenceStepResponse(BaseModel):
    step: int
    day: int
    subject: str
    body: str
    status: str
    scheduled_at: str | None = None
    channel_post_id: str | None = None
    artifact_id: str | None = None


class SequenceItemResponse(BaseModel):
    parent_artifact_id: str
    title: str
    recipient: str | None = None
    status: str
    steps: list[SequenceStepResponse] = Field(default_factory=list)


class SequenceListResponse(BaseModel):
    sequences: list[SequenceItemResponse] = Field(default_factory=list)


class AttributionSummaryResponse(BaseModel):
    period_days: int
    total_touchpoints: int
    by_channel: dict[str, int] = Field(default_factory=dict)
    by_campaign: dict[str, int] = Field(default_factory=dict)
    by_source: dict[str, int] = Field(default_factory=dict)
    unique_leads: int = 0
    first_touch_sample: list[dict[str, Any]] = Field(default_factory=list)
    last_touch_sample: list[dict[str, Any]] = Field(default_factory=list)


# Workflows (Wave 3)
class TechnicalEvalRequest(BaseModel):
    opportunity_name: str
    company: str | None = None
    question: str
    scope: str
    lead_id: uuid.UUID | None = None
    include_pricing: bool = True


class GenerateProposalRequest(BaseModel):
    scope: str
    include_pricing: bool = True
    opportunity_id: uuid.UUID | None = None


class WorkflowStepStatus(BaseModel):
    name: str
    status: str
    updated_at: str | None = None
    error: str | None = None


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
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class WorkerStatusResponse(BaseModel):
    healthy: bool
    ongoing: int
    queued: int
    idle: int
    max_jobs: int


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
    narrative_llm: str | None = None
    narrative_fresh: bool = False
    narrative_updated_at: str | None = None


class AccountHealthResponse(BaseModel):
    id: str
    opportunity_id: str
    health_score: float
    status: str
    metrics: dict[str, Any] = Field(default_factory=dict)
    playbook: dict[str, Any] = Field(default_factory=dict)
    cs_brief: dict[str, Any] = Field(default_factory=dict)
    last_cs_brief_at: str | None = None
    updated_at: str | None = None


class SuccessPlanResponse(BaseModel):
    opportunity_id: str
    health_score: float
    status: str
    playbook: dict[str, Any] = Field(default_factory=dict)
    cs_brief: dict[str, Any] = Field(default_factory=dict)


class SyncStatusResponse(BaseModel):
    enabled: bool
    provider: str | None = None
    deployment_profile: str = "full"
    enrichment_enabled: bool = True
    apollo_configured: bool = False
    sales_crm_configured: bool = False
    hubspot_configured: bool = False


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
    created_by: uuid.UUID | None = None
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
    group_label: str | None = Field(None, min_length=1, max_length=100)
    label: str | None = Field(None, min_length=1, max_length=100)
    icon: str | None = Field(None, max_length=50)
    tone: str | None = Field(None, max_length=20)
    position: int | None = None
    content_blocks: list[dict[str, Any]] | None = None


# Generic
class MessageResponse(BaseModel):
    message: str
    detail: str | None = None


# Deal workspace: requirement-to-proof
class RequirementCreateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)
    source: str = Field(default="pasted", max_length=255)


class RequirementAnalyzeRequest(BaseModel):
    requirement_ids: list[uuid.UUID] | None = None  # default: requirements with no proof yet


class ProofReviewRequest(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    comment: str | None = None
    conditions: str | None = None  # reviewer may tighten the stated conditions


class ProofResponse(BaseModel):
    id: uuid.UUID
    verdict: str
    answer: str
    conditions: str | None = None
    validation_test: str | None = None
    citations: list[dict] = Field(default_factory=list)
    claims: list[dict] = Field(default_factory=list)
    confidence: float = 0.0
    review_status: str
    reviewer_id: uuid.UUID | None = None
    review_comment: str | None = None
    stale_reason: str | None = None
    created_at: datetime | None = None


class RequirementResponse(BaseModel):
    id: uuid.UUID
    text: str
    position: int
    source: str
    owner_user_id: uuid.UUID | None = None
    proof: ProofResponse | None = None


class DealWorkspaceResponse(BaseModel):
    opportunity: OpportunityResponse
    requirements: list[RequirementResponse]
    summary: dict[str, int]
    next_actions: list[str]


class ActionItemResponse(BaseModel):
    id: str
    kind: str
    title: str
    detail: str
    product_id: uuid.UUID
    product_name: str
    href: str
    count: int = 1
    opportunity_id: uuid.UUID | None = None
    artifact_id: uuid.UUID | None = None
    age_days: int = 0


class ActionListResponse(BaseModel):
    items: list[ActionItemResponse]
    counts: dict[str, int]
    follow_up_after_days: int


class RequirementResponseDocument(BaseModel):
    artifact_id: uuid.UUID
    included: int
    skipped_unapproved: int
    skipped_stale: int
