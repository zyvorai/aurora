"""Customer portal (Phase 1 of customer/salesperson/reseller): signup, approval-gated
login, portal-token discrimination (a portal token must never satisfy get_current_user
and vice versa), and admin approve/reject."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from gtm_api.auth import create_access_token, create_portal_token, get_current_user, hash_password
from gtm_api.database import get_db
from gtm_api.main import app
from gtm_api.models import CustomerAccount, PlanTier, PortalAccountStatus, Product, Tenant, User


def _tenant(tenant_id=None, slug="acme"):
    return Tenant(id=tenant_id or uuid.uuid4(), name="Acme", slug=slug, plan=PlanTier.GROWTH, is_active=True)


def _product(product_id=None, tenant_id=None):
    return Product(id=product_id or uuid.uuid4(), tenant_id=tenant_id or uuid.uuid4(), name="Acme Product")


def _customer_account(**overrides):
    defaults = dict(
        id=uuid.uuid4(), tenant_id=uuid.uuid4(), product_id=uuid.uuid4(),
        email="cust@example.com", hashed_password=hash_password("password123"),
        status=PortalAccountStatus.PENDING, is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return CustomerAccount(**defaults)


def _admin_user(tenant_id):
    return User(
        id=uuid.uuid4(), tenant_id=tenant_id, email="admin@acme.com",
        hashed_password="x", role="admin", is_active=True,
    )


def _editor_user(tenant_id):
    return User(
        id=uuid.uuid4(), tenant_id=tenant_id, email="editor@acme.com",
        hashed_password="x", role="editor", is_active=True,
    )


def _override_db(mock_db):
    async def _get_db():
        yield mock_db

    return _get_db


def _override_current_user(user):
    async def _get_current_user():
        return user

    return _get_current_user


class TestCustomerSignup:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_signup_creates_pending_account(self):
        tenant = _tenant()
        product = _product(tenant_id=tenant.id)

        def _populate(entry):
            entry.id = uuid.uuid4()
            entry.created_at = datetime.now(timezone.utc)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),
                MagicMock(scalar_one_or_none=lambda: product),
                MagicMock(scalar_one_or_none=lambda: None),
            ]
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock(side_effect=_populate)

        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/customer/signup",
                json={
                    "tenant_slug": tenant.slug,
                    "product_id": str(product.id),
                    "email": "cust@example.com",
                    "password": "password123",
                    "company_name": "Acme Customer Co",
                },
            )

        assert response.status_code == 201
        assert response.json()["status"] == "pending"

    def test_signup_rejects_unknown_tenant(self):
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/customer/signup",
                json={
                    "tenant_slug": "nope",
                    "product_id": str(uuid.uuid4()),
                    "email": "x@example.com",
                    "password": "password123",
                },
            )
        assert response.status_code == 404

    def test_signup_rejects_duplicate_email(self):
        tenant = _tenant()
        product = _product(tenant_id=tenant.id)
        existing = _customer_account(tenant_id=tenant.id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),
                MagicMock(scalar_one_or_none=lambda: product),
                MagicMock(scalar_one_or_none=lambda: existing),
            ]
        )
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/customer/signup",
                json={
                    "tenant_slug": tenant.slug,
                    "product_id": str(product.id),
                    "email": existing.email,
                    "password": "password123",
                },
            )
        assert response.status_code == 409


class TestCustomerLogin:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_login_rejected_while_pending(self):
        tenant = _tenant()
        account = _customer_account(tenant_id=tenant.id, status=PortalAccountStatus.PENDING)

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
                "/api/v1/portal/customer/login",
                json={"tenant_slug": tenant.slug, "email": account.email, "password": "password123"},
            )
        assert response.status_code == 403

    def test_login_rejects_wrong_password(self):
        tenant = _tenant()
        account = _customer_account(tenant_id=tenant.id, status=PortalAccountStatus.APPROVED)

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
                "/api/v1/portal/customer/login",
                json={"tenant_slug": tenant.slug, "email": account.email, "password": "wrong-password"},
            )
        assert response.status_code == 401

    def test_login_succeeds_when_approved(self):
        tenant = _tenant()
        account = _customer_account(tenant_id=tenant.id, status=PortalAccountStatus.APPROVED)

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
                "/api/v1/portal/customer/login",
                json={"tenant_slug": tenant.slug, "email": account.email, "password": "password123"},
            )
        assert response.status_code == 200
        body = response.json()
        assert body["portal_type"] == "customer"
        assert body["account_id"] == str(account.id)


class TestPortalTokenDiscrimination:
    """Proves the "type": "portal" claim actually gates both directions, not just in
    theory -- an employee JWT must not reach portal routes, and a portal token must not
    reach employee routes."""

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_portal_route_rejects_employee_jwt(self):
        token = create_access_token(uuid.uuid4(), uuid.uuid4(), "admin")

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/customer/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    def test_portal_route_rejects_unapproved_account(self):
        account = _customer_account(status=PortalAccountStatus.PENDING)
        token = create_portal_token(account.id, account.tenant_id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: account))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/customer/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401

    def test_portal_route_accepts_approved_account(self):
        account = _customer_account(status=PortalAccountStatus.APPROVED)
        token = create_portal_token(account.id, account.tenant_id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: account))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/customer/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json()["email"] == account.email

    def test_get_current_user_rejects_portal_token(self):
        token = create_portal_token(uuid.uuid4(), uuid.uuid4())

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401


class TestSelfServiceProfileUpdate:
    """PATCH /portal/customer/me -- an approved customer can edit their own
    contact_name/company_name, but the request schema whitelists only those fields
    (status/email/product_id are never accepted, regardless of what's sent)."""

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_approved_customer_can_update_own_profile(self):
        account = _customer_account(status=PortalAccountStatus.APPROVED, contact_name="Old Name")
        token = create_portal_token(account.id, account.tenant_id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: account))
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.patch(
                "/api/v1/portal/customer/me",
                headers={"Authorization": f"Bearer {token}"},
                json={"contact_name": "New Name"},
            )
        assert response.status_code == 200
        assert account.contact_name == "New Name"

    def test_status_field_is_ignored_not_editable_via_self_service(self):
        account = _customer_account(status=PortalAccountStatus.APPROVED)
        token = create_portal_token(account.id, account.tenant_id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: account))
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.patch(
                "/api/v1/portal/customer/me",
                headers={"Authorization": f"Bearer {token}"},
                json={"contact_name": "New Name", "status": "rejected", "email": "hijack@example.com"},
            )
        assert response.status_code == 200
        assert account.status == PortalAccountStatus.APPROVED
        assert account.email != "hijack@example.com"

    def test_unapproved_customer_cannot_update_profile(self):
        account = _customer_account(status=PortalAccountStatus.PENDING)
        token = create_portal_token(account.id, account.tenant_id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: account))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.patch(
                "/api/v1/portal/customer/me",
                headers={"Authorization": f"Bearer {token}"},
                json={"contact_name": "New Name"},
            )
        assert response.status_code == 401


class TestAdminApproval:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_non_admin_blocked_from_listing_accounts(self):
        tenant_id = uuid.uuid4()
        app.dependency_overrides[get_current_user] = _override_current_user(_editor_user(tenant_id))
        app.dependency_overrides[get_db] = _override_db(AsyncMock())

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/customer/accounts")
        assert response.status_code == 403

    def test_admin_approve_updates_status_and_audit_logs(self):
        tenant = _tenant()
        admin = _admin_user(tenant.id)
        account = _customer_account(tenant_id=tenant.id, status=PortalAccountStatus.PENDING)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),  # get_tenant_context
                MagicMock(scalar_one_or_none=lambda: account),  # account lookup
            ]
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()

        app.dependency_overrides[get_current_user] = _override_current_user(admin)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/api/v1/portal/customer/accounts/{account.id}/approve")

        assert response.status_code == 200
        assert account.status == PortalAccountStatus.APPROVED
        assert account.reviewed_by == admin.id
        # audit_log() calls db.add() with an AuditLog row in addition to nothing else here
        added_types = [type(call.args[0]).__name__ for call in mock_db.add.call_args_list]
        assert "AuditLog" in added_types

    def test_admin_approve_sends_notification_email(self, monkeypatch):
        tenant = _tenant()
        admin = _admin_user(tenant.id)
        account = _customer_account(tenant_id=tenant.id, status=PortalAccountStatus.PENDING)

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

        mock_send = AsyncMock()
        monkeypatch.setattr("gtm_api.routers.portal.send_transactional_email", mock_send)

        app.dependency_overrides[get_current_user] = _override_current_user(admin)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(f"/api/v1/portal/customer/accounts/{account.id}/approve")

        assert response.status_code == 200
        mock_send.assert_awaited_once()
        call_args = mock_send.call_args.args
        assert call_args[0] == account.email
        assert "approved" in call_args[1].lower()

    def test_admin_reject_records_reason(self):
        tenant = _tenant()
        admin = _admin_user(tenant.id)
        account = _customer_account(tenant_id=tenant.id, status=PortalAccountStatus.PENDING)

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
            response = client.post(
                f"/api/v1/portal/customer/accounts/{account.id}/reject",
                json={"reason": "Could not verify business"},
            )

        assert response.status_code == 200
        assert account.status == PortalAccountStatus.REJECTED
        assert account.rejected_reason == "Could not verify business"
