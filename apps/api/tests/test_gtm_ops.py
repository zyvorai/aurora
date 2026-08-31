"""Tests for Tier-1 GTM ops: enrichment, inbound, attribution, sequences."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from gtm_api.models import Product
from gtm_api.services.enrichment.providers.static import enrich_static
from gtm_api.services.enrichment.waterfall import enrich_candidate
from gtm_api.services.attribution import get_attribution_summary, record_touchpoint
from gtm_api.services.sequence_runner import schedule_outreach_sequence
from gtm_api.models import Artifact, ArtifactType, ApprovalStatus


class TestEnrichment:
    def test_static_enrichment_adds_domain_persona(self):
        result = enrich_static("Acme Corp", "acme.com")
        assert result is not None
        assert result.domain == "acme.com"
        assert result.provider == "static"
        assert result.emails == ["hello@acme.com"]

    @pytest.mark.asyncio
    async def test_enrich_candidate_falls_back_to_static(self):
        with patch("gtm_api.services.enrichment.waterfall.settings") as mock_settings:
            mock_settings.enrichment_enabled = True
            mock_settings.apollo_api_key = ""
            result = await enrich_candidate("DevStack Inc", "devstack.io")
            assert result.provider == "static"
            assert result.domain == "devstack.io"


class TestInboundTokens:
    def test_token_is_deterministic(self):
        from gtm_api.services.inbound_tokens import inbound_token, verify_inbound_token

        pid = str(uuid.uuid4())
        token = inbound_token(pid)
        assert len(token) == 32
        assert verify_inbound_token(pid, token)
        assert not verify_inbound_token(pid, "bad-key")


class TestContactEnrichment:
    @pytest.mark.asyncio
    async def test_enrich_contact_falls_back_to_static(self):
        from gtm_api.services.enrichment.waterfall import enrich_contact

        with patch("gtm_api.services.enrichment.waterfall.settings") as mock_settings:
            mock_settings.enrichment_enabled = True
            mock_settings.apollo_api_key = ""
            result = await enrich_contact(email="cto@acme.com", domain="acme.com", company_name="Acme")
            assert result.domain == "acme.com"
            assert "cto@acme.com" in result.emails or result.emails == ["hello@acme.com"]


class TestAttribution:
    @pytest.mark.asyncio
    async def test_record_touchpoint_emits_event(self):
        mock_db = AsyncMock()
        tenant_id = uuid.uuid4()
        product_id = uuid.uuid4()
        await record_touchpoint(
            mock_db, tenant_id, product_id,
            touch_type="inbound_form", channel="web", campaign="launch",
            source="google", lead_id="abc", email="test@example.com",
        )
        mock_db.add.assert_called()


class TestSequenceRunner:
    @pytest.mark.asyncio
    async def test_schedule_outreach_sequence_creates_posts(self):
        tenant_id = uuid.uuid4()
        product_id = uuid.uuid4()
        artifact = Artifact(
            id=uuid.uuid4(),
            product_id=product_id,
            tenant_id=tenant_id,
            artifact_type=ArtifactType.OUTREACH,
            title="Outreach",
            content="Hi there",
            content_hash="abc123",
            status=ApprovalStatus.APPROVED,
            metadata_={
                "follow_up_sequence": [
                    {"day": 3, "subject": "Follow 1", "body": "Checking in"},
                    {"day": 7, "subject": "Follow 2", "body": "Still interested?"},
                ],
                "recipient_email": "cto@acme.com",
            },
        )
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()

        posts = await schedule_outreach_sequence(mock_db, artifact, tenant_id)
        assert len(posts) == 2
        assert posts[0].channel == "email"
        assert posts[0].status == "scheduled"
