"""Analytics funnel scoping: every count honours the product and date window."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from gtm_api.services.analytics import FUNNEL_DEFINITIONS, get_analytics

TENANT, PRODUCT = uuid.uuid4(), uuid.uuid4()


def _db():
    statements = []

    async def execute(stmt):
        statements.append(stmt)
        r = MagicMock()
        r.scalar.return_value = 7
        r.all.return_value = []
        return r

    db = AsyncMock()
    db.execute = execute
    return db, statements


def _sql(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect())).replace("\n", " ")


def _count_statements(statements, table):
    return [s for s in statements if f"FROM {table}" in _sql(s) and "count(" in _sql(s)]


@pytest.mark.asyncio
async def test_entity_counts_are_filtered_by_product_and_window():
    db, statements = _db()
    await get_analytics(db, TENANT, PRODUCT, days=7)
    for table, date_col in [
        ("leads", "created_at"),
        ("conversations", "created_at"),
        ("artifacts", "created_at"),
        ("agent_runs", "started_at"),
    ]:
        sqls = [_sql(s) for s in _count_statements(statements, table)]
        assert sqls, table
        for sql in sqls:
            assert f"{table}.product_id" in sql, table
            assert f"{table}.{date_col} >=" in sql, table


@pytest.mark.asyncio
async def test_no_product_filter_when_product_not_given():
    db, statements = _db()
    await get_analytics(db, TENANT, None, days=30)
    for s in _count_statements(statements, "artifacts"):
        assert "artifacts.product_id" not in _sql(s)


@pytest.mark.asyncio
async def test_qualified_leads_are_a_subset_of_total_leads():
    db, statements = _db()
    out = await get_analytics(db, TENANT, PRODUCT)
    lead_sqls = [_sql(s) for s in _count_statements(statements, "leads")]
    assert len(lead_sqls) == 2
    assert sum("leads.stage" in q for q in lead_sqls) == 1
    assert {"leads_total", "qualified_leads"} <= out["funnel"].keys()


@pytest.mark.asyncio
async def test_every_funnel_metric_has_a_definition():
    db, _ = _db()
    out = await get_analytics(db, TENANT, PRODUCT)
    assert set(out["funnel"]) <= set(out["definitions"]) == set(FUNNEL_DEFINITIONS)
    assert out["window"]["days"] == 30 and out["window"]["product_id"] == str(PRODUCT)
