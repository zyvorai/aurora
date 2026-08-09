"""Customer portal support tickets -- Jira-style status/priority workflow, scoped so a
customer only ever sees their own tickets, and admin triage covers the whole tenant."""

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from gtm_api.auth import create_portal_token, get_current_user, hash_password
from gtm_api.database import get_db
from gtm_api.main import app
from gtm_api.models import (
    CustomerAccount,
    CustomerTicket,
    PlanTier,
    PortalAccountStatus,
    Tenant,
    TicketPriority,
    TicketStatus,
    User,
)


def _tenant(tenant_id=None):
    return Tenant(id=tenant_id or uuid.uuid4(), name="Acme", slug="acme", plan=PlanTier.GROWTH, is_active=True)


def _customer_account(**overrides):
    defaults = dict(
        id=uuid.uuid4(), tenant_id=uuid.uuid4(), product_id=uuid.uuid4(),
        email="cust@example.com", hashed_password=hash_password("password123"),
        status=PortalAccountStatus.APPROVED, is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return CustomerAccount(**defaults)


def _ticket(**overrides):
    defaults = dict(
        id=uuid.uuid4(), tenant_id=uuid.uuid4(), customer_account_id=uuid.uuid4(),
        subject="Can't log in", description="Getting a 500 error on login.",
        status=TicketStatus.OPEN, priority=TicketPriority.MEDIUM,
        created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return CustomerTicket(**defaults)


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


class TestCreateTicket:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_approved_customer_can_create_ticket(self):
        account = _customer_account(status=PortalAccountStatus.APPROVED)
        token = create_portal_token(account.id, account.tenant_id, portal_type="customer")

        def _populate(entry):
            entry.id = uuid.uuid4()
            entry.status = TicketStatus.OPEN
            entry.created_at = datetime.now(timezone.utc)
            entry.updated_at = datetime.now(timezone.utc)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: account))
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock(side_effect=_populate)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/customer/tickets",
                headers={"Authorization": f"Bearer {token}"},
                json={"subject": "Can't log in", "description": "500 error", "priority": "high"},
            )
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "open"
        assert body["priority"] == "high"

    def test_unapproved_customer_cannot_create_ticket(self):
        account = _customer_account(status=PortalAccountStatus.PENDING)
        token = create_portal_token(account.id, account.tenant_id, portal_type="customer")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: account))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/customer/tickets",
                headers={"Authorization": f"Bearer {token}"},
                json={"subject": "x", "description": "y"},
            )
        assert response.status_code == 401

    def test_reseller_token_rejected(self):
        from gtm_api.models import ResellerAccount

        reseller = ResellerAccount(
            id=uuid.uuid4(), tenant_id=uuid.uuid4(), email="r@example.com",
            hashed_password=hash_password("x"), status=PortalAccountStatus.APPROVED, is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        token = create_portal_token(reseller.id, reseller.tenant_id, portal_type="reseller")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: reseller))
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                "/api/v1/portal/customer/tickets",
                headers={"Authorization": f"Bearer {token}"},
                json={"subject": "x", "description": "y"},
            )
        assert response.status_code == 403


class TestListAndGetTickets:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_customer_lists_only_own_tickets(self):
        account = _customer_account(status=PortalAccountStatus.APPROVED)
        token = create_portal_token(account.id, account.tenant_id, portal_type="customer")
        own_ticket = _ticket(tenant_id=account.tenant_id, customer_account_id=account.id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: account),  # get_current_portal_account
                MagicMock(scalars=lambda: MagicMock(all=lambda: [own_ticket])),
            ]
        )
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get(
                "/api/v1/portal/customer/tickets", headers={"Authorization": f"Bearer {token}"}
            )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["id"] == str(own_ticket.id)

    def test_customer_cannot_get_someone_elses_ticket(self):
        account = _customer_account(status=PortalAccountStatus.APPROVED)
        token = create_portal_token(account.id, account.tenant_id, portal_type="customer")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: account),
                MagicMock(scalar_one_or_none=lambda: None),  # ticket lookup scoped to this account finds nothing
            ]
        )
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get(
                f"/api/v1/portal/customer/tickets/{uuid.uuid4()}",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 404


class TestAdminTicketTriage:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_non_admin_blocked_from_listing_all_tickets(self):
        tenant_id = uuid.uuid4()
        editor = User(
            id=uuid.uuid4(), tenant_id=tenant_id, email="editor@acme.com",
            hashed_password="x", role="editor", is_active=True,
        )
        app.dependency_overrides[get_current_user] = _override_current_user(editor)
        app.dependency_overrides[get_db] = _override_db(AsyncMock())

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/customer/admin/tickets")
        assert response.status_code == 403

    def test_admin_lists_all_tickets_with_customer_identity(self):
        tenant = _tenant()
        admin = _admin_user(tenant.id)
        account = _customer_account(tenant_id=tenant.id, email="cust@example.com", company_name="Acme Co")
        ticket = _ticket(tenant_id=tenant.id, customer_account_id=account.id)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),  # get_tenant_context
                MagicMock(all=lambda: [(ticket, account)]),  # joined ticket+customer query
            ]
        )
        app.dependency_overrides[get_current_user] = _override_current_user(admin)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.get("/api/v1/portal/customer/admin/tickets")
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["customer_email"] == "cust@example.com"
        assert body[0]["customer_company_name"] == "Acme Co"

    def test_admin_updates_ticket_status_to_resolved_stamps_resolver(self):
        tenant = _tenant()
        admin = _admin_user(tenant.id)
        ticket = _ticket(tenant_id=tenant.id, status=TicketStatus.OPEN)

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(
            side_effect=[
                MagicMock(scalar_one_or_none=lambda: tenant),
                MagicMock(scalar_one_or_none=lambda: ticket),
            ]
        )
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()
        app.dependency_overrides[get_current_user] = _override_current_user(admin)
        app.dependency_overrides[get_db] = _override_db(mock_db)

        with TestClient(app) as client:
            response = client.post(
                f"/api/v1/portal/customer/admin/tickets/{ticket.id}/status",
                json={"status": "resolved"},
            )
        assert response.status_code == 200
        assert ticket.status == TicketStatus.RESOLVED
        assert ticket.resolved_by == admin.id
        assert ticket.resolved_at is not None
