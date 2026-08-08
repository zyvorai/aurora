"""Sales-person portal (Phase 3, reusing the customer/reseller portal's shared
foundation): signup, approval-gated login, cross-portal-type token discrimination, and
scoped-pipeline visibility (a sales person must only see leads/opportunities assigned to
their own account, via Lead.assigned_sales_person_id / Opportunity.assigned_sales_person_id)."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from gtm_api.auth import create_portal_token, get_current_user, hash_password
from gtm_api.database import get_db
from gtm_api.main import app
from gtm_api.models import (
    CustomerAccount,
    Lead,
    Opportunity,
    PlanTier,
    PortalAccountStatus,
    SalesPersonAccount,
    Tenant,
    User,
)


def _tenant(tenant_id=None, slug="acme"):
    return Tenant(id=tenant_id or uuid.uuid4(), name="Acme", slug=slug, plan=PlanTier.GROWTH, is_active=True)


def _salesperson_account(**overrides):
    defaults = dict(
        id=uuid.uuid4(), tenant_id=uuid.uuid4(),
        email="rep@example.com", hashed_password=hash_password("password123"),
        status=PortalAccountStatus.PENDING, is_active=True,
        commission_rate=0.0, created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return SalesPersonAccount(**defaults)


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


class TestSalesPersonSignup:
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
                "/api/v1/portal/salesperson/signup",
                json={
                    "tenant_slug": tenant.slug,
                    "email": "rep@example.com",
                    "password": "password123",
                    "contact_name": "Jamie Rep",
                    "territory": "West",
                },
            )
        assert response.status_code == 201
        assert response.json()["status"] == "pending"

    def test_signup_rejects_duplicate_email(self):
        tenant = _tenant()
        existing = _salesperson_account(tenant_id=tenant.id)

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
                "/api/v1/portal/salesperson/signup",
                json={"tenant_slug": tenant.slug, "email": existing.email, "password": "password123"},
            )
        assert response.status_code == 409


class TestSalesPersonLogin:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_login_rejected_while_pending(self):
        tenant = _tenant()
        account = _salesperson_account(tenant_id=tenant.id, status=PortalAccountStatus.PENDING)

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
                "/api/v1/portal/salesperson/login",
                json={"tenant_slug": tenant.slug, "email": account.email, "password": "password123"},
            )
        assert response.status_code == 403

    def test_login_succeeds_when_approved(self):
        tenant = _tenant()
        account = _salesperson_account(tenant_id=tenant.id, status=PortalAccountStatus.APPROVED)

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
                "/api/v1/portal/salesperson/login",
                json={"tenant_slug": tenant.slug, "email": account.email, "password": "password123"},
            )
        assert response.status_code == 200
        body = response.json()
        assert body["portal_type"] == "salesperson"
        assert body["account_id"] == str(account.id)


class TestCrossPortalTypeDiscrimination:
    """A sales-person token must not satisfy the customer or reseller portal's routes,
    and vice versa -- proves PORTAL_ACCOUNT_MODELS dispatch covers all three types."""

    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_salesperson_token_rejected_by_customer_me(self):
        rep = _salesperson_account(status=PortalAccountStatus.APPROVED)
        token = create_portal_token(rep.id, rep.tenant_id, portal_type="salesperson")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: rep))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/customer/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

    def test_customer_token_rejected_by_salesperson_me(self):
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
            response = client.get("/api/v1/portal/salesperson/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403


class TestSelfServiceProfileUpdate:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_approved_salesperson_can_update_own_profile(self):
        rep = _salesperson_account(status=PortalAccountStatus.APPROVED, territory="East")
        token = create_portal_token(rep.id, rep.tenant_id, portal_type="salesperson")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: rep))
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.patch(
                "/api/v1/portal/salesperson/me",
                headers={"Authorization": f"Bearer {token}"},
                json={"territory": "West"},
            )
        assert response.status_code == 200
        assert rep.territory == "West"

    def test_unapproved_salesperson_cannot_update_profile(self):
        rep = _salesperson_account(status=PortalAccountStatus.PENDING)
        token = create_portal_token(rep.id, rep.tenant_id, portal_type="salesperson")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: rep))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.patch(
                "/api/v1/portal/salesperson/me",
                headers={"Authorization": f"Bearer {token}"},
                json={"territory": "West"},
            )
        assert response.status_code == 401


class TestSalesPersonPipeline:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_unapproved_salesperson_cannot_view_pipeline(self):
        rep = _salesperson_account(status=PortalAccountStatus.PENDING)
        token = create_portal_token(rep.id, rep.tenant_id, portal_type="salesperson")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: rep))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get(
                "/api/v1/portal/salesperson/my-pipeline", headers={"Authorization": f"Bearer {token}"}
            )
        assert response.status_code == 401

    def test_pipeline_scoped_to_own_assigned_rows(self):
        rep = _salesperson_account(status=PortalAccountStatus.APPROVED)
        token = create_portal_token(rep.id, rep.tenant_id, portal_type="salesperson")

        lead = Lead(
            id=uuid.uuid4(), product_id=uuid.uuid4(), tenant_id=rep.tenant_id,
            company="Prospect Co", name="Pat Prospect", stage="new", score=0.0,
            assigned_sales_person_id=rep.id, created_at=datetime.now(timezone.utc),
        )
        opportunity = Opportunity(
            id=uuid.uuid4(), product_id=uuid.uuid4(), tenant_id=rep.tenant_id,
            name="Prospect Co deal", stage="discovery", probability=0.1,
            assigned_sales_person_id=rep.id, metadata_={},
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        )

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: rep),  # get_current_portal_account
                MagicMock(scalars=lambda: MagicMock(all=lambda: [lead])),  # leads query
                MagicMock(scalars=lambda: MagicMock(all=lambda: [opportunity])),  # opportunities query
            ]
        )
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get(
                "/api/v1/portal/salesperson/my-pipeline", headers={"Authorization": f"Bearer {token}"}
            )
        assert response.status_code == 200
        body = response.json()
        assert len(body["leads"]) == 1
        assert body["leads"][0]["id"] == str(lead.id)
        assert len(body["opportunities"]) == 1
        assert body["opportunities"][0]["id"] == str(opportunity.id)


class TestProofOfBusinessDocument:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_pending_salesperson_can_upload_document(self, monkeypatch):
        rep = _salesperson_account(status=PortalAccountStatus.PENDING)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: rep))
        mock_db.flush = AsyncMock()
        app.dependency_overrides[get_db] = _override_db(mock_db)

        mock_put = MagicMock(side_effect=lambda key, data, content_type: key)
        monkeypatch.setattr("gtm_api.routers.portal.storage_service.put_bytes", mock_put)

        with TestClient(app) as client:
            response = client.post(
                f"/api/v1/portal/salesperson/signup/{rep.id}/document",
                files={"file": ("w9.pdf", b"%PDF-1.4 fake", "application/pdf")},
            )
        assert response.status_code == 200
        expected_key = f"portal-documents/{rep.tenant_id}/salesperson/{rep.id}/w9.pdf"
        assert response.json()["proof_document_key"] == expected_key
        assert rep.proof_document_key == expected_key

    def test_upload_rejected_once_account_is_no_longer_pending(self):
        rep = _salesperson_account(status=PortalAccountStatus.APPROVED)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: rep))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                f"/api/v1/portal/salesperson/signup/{rep.id}/document",
                files={"file": ("w9.pdf", b"%PDF-1.4 fake", "application/pdf")},
            )
        assert response.status_code == 409


class TestAdminApprovalSalesPerson:
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
            response = client.get("/api/v1/portal/salesperson/accounts")
        assert response.status_code == 403

    def test_admin_approve_updates_status(self):
        tenant = _tenant()
        admin = _admin_user(tenant.id)
        account = _salesperson_account(tenant_id=tenant.id, status=PortalAccountStatus.PENDING)

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
            response = client.post(f"/api/v1/portal/salesperson/accounts/{account.id}/approve")

        assert response.status_code == 200
        assert account.status == PortalAccountStatus.APPROVED
        assert account.reviewed_by == admin.id

    def test_admin_reject_sets_reason(self):
        tenant = _tenant()
        admin = _admin_user(tenant.id)
        account = _salesperson_account(tenant_id=tenant.id, status=PortalAccountStatus.PENDING)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),
                MagicMock(scalar_one_or_none=lambda: account),
            ]
        )
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()
        app.dependency_overrides[get_current_user] = _override_current_user(admin)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                f"/api/v1/portal/salesperson/accounts/{account.id}/reject",
                json={"reason": "Not a fit"},
            )

        assert response.status_code == 200
        assert account.status == PortalAccountStatus.REJECTED
        assert account.rejected_reason == "Not a fit"
