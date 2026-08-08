"""Reseller portal (Phase 2, reusing the customer portal's shared foundation): signup,
approval-gated login, deal registration, and cross-portal-type token discrimination
(a reseller token must not satisfy the customer portal's /me and vice versa)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from gtm_api.auth import create_portal_token, get_current_user, hash_password
from gtm_api.database import get_db
from gtm_api.main import app
from gtm_api.models import (
    CustomerAccount,
    DiscoveredAccount,
    PlanTier,
    PortalAccountStatus,
    Product,
    ResellerAccount,
    Tenant,
    User,
)


def _tenant(tenant_id=None, slug="acme"):
    return Tenant(id=tenant_id or uuid.uuid4(), name="Acme", slug=slug, plan=PlanTier.GROWTH, is_active=True)


def _product(product_id=None, tenant_id=None):
    return Product(id=product_id or uuid.uuid4(), tenant_id=tenant_id or uuid.uuid4(), name="Acme Product")


def _reseller_account(**overrides):
    defaults = dict(
        id=uuid.uuid4(), tenant_id=uuid.uuid4(),
        email="reseller@example.com", hashed_password=hash_password("password123"),
        status=PortalAccountStatus.PENDING, is_active=True,
        margin_tier="standard", created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return ResellerAccount(**defaults)


def _admin_user(tenant_id):
    return User(
        id=uuid.uuid4(), tenant_id=tenant_id, email="admin@acme.com",
        hashed_password="x", role="admin", is_active=True,
    )


def _override_db(mock_db):
    async def _get_db():
        yield mock_db

    return _get_db


def _override_current_user(user):
    async def _get_current_user():
        return user

    return _get_current_user


class TestResellerSignup:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_signup_creates_pending_account(self):
        tenant = _tenant()

        def _populate(entry):
            entry.id = uuid.uuid4()
            entry.created_at = datetime.now(timezone.utc)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),
                MagicMock(scalar_one_or_none=lambda: None),
            ]
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock(side_effect=_populate)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/reseller/signup",
                json={
                    "tenant_slug": tenant.slug,
                    "email": "reseller@example.com",
                    "password": "password123",
                    "company_name": "Acme Resale Co",
                    "business_id": "BIZ-123",
                },
            )
        assert response.status_code == 201
        assert response.json()["status"] == "pending"

    def test_signup_rejects_duplicate_email(self):
        tenant = _tenant()
        existing = _reseller_account(tenant_id=tenant.id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),
                MagicMock(scalar_one_or_none=lambda: existing),
            ]
        )
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/reseller/signup",
                json={"tenant_slug": tenant.slug, "email": existing.email, "password": "password123"},
            )
        assert response.status_code == 409


class TestResellerLogin:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_login_rejected_while_pending(self):
        tenant = _tenant()
        account = _reseller_account(tenant_id=tenant.id, status=PortalAccountStatus.PENDING)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),
                MagicMock(scalar_one_or_none=lambda: account),
            ]
        )
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/reseller/login",
                json={"tenant_slug": tenant.slug, "email": account.email, "password": "password123"},
            )
        assert response.status_code == 403

    def test_login_succeeds_when_approved(self):
        tenant = _tenant()
        account = _reseller_account(tenant_id=tenant.id, status=PortalAccountStatus.APPROVED)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),
                MagicMock(scalar_one_or_none=lambda: account),
            ]
        )
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/reseller/login",
                json={"tenant_slug": tenant.slug, "email": account.email, "password": "password123"},
            )
        assert response.status_code == 200
        body = response.json()
        assert body["portal_type"] == "reseller"
        assert body["account_id"] == str(account.id)


class TestCrossPortalTypeDiscrimination:
    """A reseller token must not satisfy the customer portal's routes, and vice versa --
    proves PORTAL_ACCOUNT_MODELS dispatch is actually enforced, not just present."""

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_reseller_token_rejected_by_customer_me(self):
        reseller = _reseller_account(status=PortalAccountStatus.APPROVED)
        token = create_portal_token(reseller.id, reseller.tenant_id, portal_type="reseller")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: reseller))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/customer/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

    def test_customer_token_rejected_by_reseller_me(self):
        customer = CustomerAccount(
            id=uuid.uuid4(), tenant_id=uuid.uuid4(), product_id=uuid.uuid4(),
            email="cust@example.com", hashed_password=hash_password("x"),
            status=PortalAccountStatus.APPROVED, is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        token = create_portal_token(customer.id, customer.tenant_id, portal_type="customer")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: customer))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/reseller/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

    def test_unknown_portal_type_in_token_rejected(self):
        token = create_portal_token(uuid.uuid4(), uuid.uuid4(), portal_type="not-a-real-type")

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/reseller/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401


class TestDealRegistration:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_approved_reseller_registers_deal(self):
        reseller = _reseller_account(status=PortalAccountStatus.APPROVED)
        token = create_portal_token(reseller.id, reseller.tenant_id, portal_type="reseller")
        product = _product(tenant_id=reseller.tenant_id)

        def _populate(entry):
            entry.id = uuid.uuid4()
            entry.created_at = datetime.now(timezone.utc)
            entry.status = "new"

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: reseller),  # get_current_portal_account
                MagicMock(scalar_one_or_none=lambda: product),  # product lookup
            ]
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock(side_effect=_populate)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/reseller/deals",
                headers={"Authorization": f"Bearer {token}"},
                json={"product_id": str(product.id), "company_name": "New Prospect Inc"},
            )
        assert response.status_code == 201
        added = [call.args[0] for call in mock_db.add.call_args_list if isinstance(call.args[0], DiscoveredAccount)]
        assert len(added) == 1
        assert added[0].registered_by_reseller_id == reseller.id
        assert added[0].source == "reseller_referral"

    def test_unapproved_reseller_cannot_register_deal(self):
        reseller = _reseller_account(status=PortalAccountStatus.PENDING)
        token = create_portal_token(reseller.id, reseller.tenant_id, portal_type="reseller")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: reseller))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/reseller/deals",
                headers={"Authorization": f"Bearer {token}"},
                json={"product_id": str(uuid.uuid4()), "company_name": "New Prospect Inc"},
            )
        assert response.status_code == 401


class TestAdminApprovalReseller:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_non_admin_blocked_from_listing_accounts(self):
        tenant_id = uuid.uuid4()
        editor = User(
            id=uuid.uuid4(), tenant_id=tenant_id, email="editor@acme.com",
            hashed_password="x", role="editor", is_active=True,
        )
        app.dependency_overrides[get_current_user] = _override_current_user(editor)
        app.dependency_overrides[get_db] = _override_db(AsyncMock())

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/reseller/accounts")
        assert response.status_code == 403

    def test_admin_approve_updates_status(self):
        tenant = _tenant()
        admin = _admin_user(tenant.id)
        account = _reseller_account(tenant_id=tenant.id, status=PortalAccountStatus.PENDING)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),
                MagicMock(scalar_one_or_none=lambda: account),
            ]
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()
        app.dependency_overrides[get_current_user] = _override_current_user(admin)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/api/v1/portal/reseller/accounts/{account.id}/approve")

        assert response.status_code == 200
        assert account.status == PortalAccountStatus.APPROVED
        assert account.reviewed_by == admin.id
