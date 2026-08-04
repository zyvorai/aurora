"""Tests for tenant quota and usage tracking."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from gtm_api.models import UsageMeter
from gtm_api.tenant import record_usage


@pytest.mark.asyncio
async def test_record_usage_handles_null_meter_counters():
    tenant_id = uuid.uuid4()
    meter = UsageMeter(tenant_id=tenant_id, period="2026-08")
    meter.tokens_used = None
    meter.pages_crawled = None
    meter.agent_runs = None

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = meter

    db = AsyncMock()
    db.execute.return_value = result_mock

    await record_usage(db, tenant_id, tokens=50, pages=100, agent_runs=2)

    assert meter.tokens_used == 50
    assert meter.pages_crawled == 100
    assert meter.agent_runs == 2
