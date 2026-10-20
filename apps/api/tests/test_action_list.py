"""Daily action list: grouping, ordering and thresholds."""

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from gtm_api.models import ApprovalStatus, ArtifactType
from gtm_api.services.action_list import FOLLOW_UP_AFTER_DAYS, build_action_list

NOW = datetime(2026, 10, 20, tzinfo=UTC)
TENANT, PRODUCT = uuid.uuid4(), uuid.uuid4()


def _opp(name="Acme", stage="technical_eval", created_days_ago=1):
    return SimpleNamespace(id=uuid.uuid4(), product_id=PRODUCT, name=name, stage=stage,
                           created_at=NOW - timedelta(days=created_days_ago))


def _req(opp, days_ago=2):
    return SimpleNamespace(id=uuid.uuid4(), opportunity_id=opp.id, created_at=NOW - timedelta(days=days_ago))


def _proof(req, verdict="supported", review="approved", stale=None, days_ago=1):
    return SimpleNamespace(requirement_id=req.id, verdict=verdict, review_status=review,
                           stale_reason=stale, created_at=NOW - timedelta(days=days_ago))


def _artifact(status=ApprovalStatus.PENDING, stale=None, title="Launch email"):
    return SimpleNamespace(id=uuid.uuid4(), product_id=PRODUCT, title=title,
                           artifact_type=ArtifactType.EMAIL, status=status, stale_reason=stale,
                           stale_since=NOW - timedelta(days=1) if stale else None,
                           created_at=NOW - timedelta(days=3))


def _db(opps=(), reqs=(), proofs=(), activity=(), artifacts=()):
    def res(all_=None, scalars=None):
        r = MagicMock()
        r.all.return_value = list(all_ or [])
        r.scalars.return_value.all.return_value = list(scalars or [])
        return r

    queue = [res(all_=[(o, "Prod") for o in opps])]
    if opps:
        queue.append(res(scalars=reqs))
        if reqs:
            queue.append(res(scalars=proofs))
        queue.append(res(all_=activity))
    queue.append(res(all_=[(a, "Prod") for a in artifacts]))
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=queue)
    return db


@pytest.mark.asyncio
async def test_empty_state():
    assert await build_action_list(_db(), TENANT, NOW) == []


@pytest.mark.asyncio
async def test_groups_per_deal_and_orders_by_risk():
    opp = _opp()
    r1, r2, r3, r4 = (_req(opp) for _ in range(4))
    proofs = [
        _proof(r1, stale="source_changed"),
        _proof(r2, review="pending"),
        _proof(r3, verdict="gap"),
        # r4 has no proof at all
    ]
    recent = [(opp.id, NOW - timedelta(days=1))]
    items = await build_action_list(_db([opp], [r1, r2, r3, r4], proofs, recent, [_artifact()]), TENANT, NOW)
    assert [i.kind for i in items] == ["stale_proof", "proof_review", "needs_answer", "artifact_review"]
    by_kind = {i.kind: i for i in items}
    assert by_kind["needs_answer"].count == 2  # gap + unanalyzed
    assert by_kind["stale_proof"].href == f"/products/{PRODUCT}/deals/{opp.id}"
    assert by_kind["artifact_review"].href == f"/products/{PRODUCT}?tab=publish"


@pytest.mark.asyncio
async def test_stale_proof_is_not_also_listed_for_review():
    opp = _opp()
    r = _req(opp)
    items = await build_action_list(
        _db([opp], [r], [_proof(r, review="pending", stale="source_changed")], [(opp.id, NOW)]), TENANT, NOW
    )
    assert [i.kind for i in items] == ["stale_proof"]


@pytest.mark.asyncio
async def test_fully_approved_deal_has_no_requirement_actions():
    opp = _opp()
    r = _req(opp)
    items = await build_action_list(_db([opp], [r], [_proof(r)], [(opp.id, NOW)]), TENANT, NOW)
    assert items == []


@pytest.mark.asyncio
async def test_follow_up_threshold_uses_last_activity_else_creation():
    quiet, active, new_quiet = _opp("Quiet", created_days_ago=30), _opp("Active", created_days_ago=30), _opp("Fresh", created_days_ago=2)
    activity = [
        (quiet.id, NOW - timedelta(days=FOLLOW_UP_AFTER_DAYS)),
        (active.id, NOW - timedelta(days=FOLLOW_UP_AFTER_DAYS - 1)),
    ]
    items = await build_action_list(_db([quiet, active, new_quiet], [], [], activity), TENANT, NOW)
    assert [(i.kind, i.opportunity_id) for i in items] == [("follow_up", quiet.id)]
    assert items[0].age_days == FOLLOW_UP_AFTER_DAYS


@pytest.mark.asyncio
async def test_stale_artifacts_outrank_pending_and_are_labelled():
    exact = _artifact(status=ApprovalStatus.APPROVED, stale="source_changed", title="Datasheet")
    unverified = _artifact(status=ApprovalStatus.APPROVED, stale="source_changed_unverified", title="Deck")
    items = await build_action_list(_db(artifacts=[_artifact(), exact, unverified]), TENANT, NOW)
    assert [i.kind for i in items] == ["stale_artifact", "stale_artifact", "artifact_review"]
    assert "no recorded citations" in next(i for i in items if "Deck" in i.title).detail
    assert "cited has changed" in next(i for i in items if "Datasheet" in i.title).detail


def test_action_list_route_registered():
    from gtm_api.main import app

    assert "/api/v1/action-list" in app.openapi()["paths"]
