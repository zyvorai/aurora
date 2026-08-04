"""Wave 2 pipeline tests — discovery, qualification (T0/T1)."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from gtm_api.models import DiscoveredAccount, Product
from gtm_api.services.lead_discovery import discover_leads, parse_csv_accounts
from gtm_api.services.lead_qualification import qualify_leads, score_account, score_to_tier


class TestLeadDiscovery:
    def test_parse_csv_accounts(self):
        csv_text = "company_name,domain,industry,title\nAcme Corp,acme.com,fintech,CTO\n"
        rows = parse_csv_accounts(csv_text)
        assert len(rows) == 1
        assert rows[0]["company_name"] == "Acme Corp"
        assert rows[0]["domain"] == "acme.com"

    @pytest.mark.asyncio
    async def test_discover_leads_rules_no_llm(self):
        product = Product(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            name="Test",
            profile={"industries": ["fintech"]},
        )
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
        mock_db.flush = AsyncMock()

        result = await discover_leads(
            mock_db, product, product.tenant_id,
            focus_industries=["fintech"], max_leads=5,
        )
        assert result["discovered_count"] >= 1
        assert "fintech" in result["industries_used"]


class TestLeadQualification:
    def test_score_account_industry_match(self):
        account = DiscoveredAccount(
            id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            company_name="Acme",
            domain="acme.com",
            industry="fintech",
            personas=[{"title": "CTO"}],
        )
        score, factors = score_account(account, target_industries=["fintech"])
        assert score >= 75
        assert factors.get("industry_match") == 25
        assert score_to_tier(score) == "A"

    def test_score_to_tier(self):
        assert score_to_tier(80) == "A"
        assert score_to_tier(55) == "B"
        assert score_to_tier(30) == "C"

    @pytest.mark.asyncio
    async def test_qualify_leads_no_llm(self):
        tenant_id = uuid.uuid4()
        product = Product(id=uuid.uuid4(), tenant_id=tenant_id, name="Test")
        account = DiscoveredAccount(
            id=uuid.uuid4(),
            product_id=product.id,
            tenant_id=tenant_id,
            company_name="NovaPay",
            domain="novapay.example",
            industry="fintech",
            personas=[{"title": "CTO"}],
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [account]
        mock_strategy = MagicMock()
        mock_strategy.scalar_one_or_none.return_value = None

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(side_effect=[mock_strategy, mock_result])
        mock_db.flush = AsyncMock()
        mock_db.add = MagicMock()

        result = await qualify_leads(mock_db, product, tenant_id, focus_industries=["fintech"])
        assert result["qualified_count"] == 1
        assert result["tier_a"] >= 1
