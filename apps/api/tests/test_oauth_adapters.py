"""OAuth publish adapters (LinkedIn/X/Medium/Dev.to/Reddit): degrade to not_configured
without credentials, make a real (mocked) API call once configured, and map both
success and failure responses onto ProviderResult."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from gtm_api.models import Artifact, ArtifactType
from gtm_api.services.publishing_adapters import oauth_adapters


def _artifact():
    return Artifact(
        id=uuid.uuid4(), product_id=uuid.uuid4(), tenant_id=uuid.uuid4(),
        artifact_type=ArtifactType.CONTENT, title="A post", content="body text",
    )


def _mock_client(status_code=201, json_body=None, headers=None, text=""):
    response = MagicMock()
    response.status_code = status_code
    response.json = MagicMock(return_value=json_body or {})
    response.headers = headers or {}
    response.text = text

    client = AsyncMock()
    client.post = AsyncMock(return_value=response)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    return client


class TestNotConfiguredDegradesWithoutNetworkCall:
    @pytest.mark.asyncio
    async def test_linkedin_not_configured(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "linkedin_access_token", "")
        monkeypatch.setattr(oauth_adapters.settings, "linkedin_author_urn", "")
        with patch("gtm_api.services.publishing_adapters.oauth_adapters.httpx.AsyncClient") as mock_client_cls:
            result = await oauth_adapters.linkedin_publish(_artifact(), MagicMock())
        assert result.status == "not_configured"
        mock_client_cls.assert_not_called()

    @pytest.mark.asyncio
    async def test_x_not_configured(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "x_bearer_token", "")
        result = await oauth_adapters.x_publish(_artifact(), MagicMock())
        assert result.status == "not_configured"

    @pytest.mark.asyncio
    async def test_medium_not_configured(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "medium_access_token", "")
        monkeypatch.setattr(oauth_adapters.settings, "medium_author_id", "")
        result = await oauth_adapters.medium_publish(_artifact(), MagicMock())
        assert result.status == "not_configured"

    @pytest.mark.asyncio
    async def test_devto_not_configured(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "devto_api_key", "")
        result = await oauth_adapters.devto_publish(_artifact(), MagicMock())
        assert result.status == "not_configured"

    @pytest.mark.asyncio
    async def test_reddit_not_configured(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "reddit_access_token", "")
        monkeypatch.setattr(oauth_adapters.settings, "reddit_subreddit", "")
        result = await oauth_adapters.reddit_publish(_artifact(), MagicMock())
        assert result.status == "not_configured"


class TestConfiguredMakesRealCall:
    @pytest.mark.asyncio
    async def test_linkedin_success(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "linkedin_access_token", "tok")
        monkeypatch.setattr(oauth_adapters.settings, "linkedin_author_urn", "urn:li:organization:1")
        client = _mock_client(status_code=201, headers={"x-restli-id": "urn:li:share:123"})

        with patch("gtm_api.services.publishing_adapters.oauth_adapters.httpx.AsyncClient", return_value=client):
            result = await oauth_adapters.linkedin_publish(_artifact(), MagicMock())

        assert result.status == "published"
        assert result.provider_message_id == "urn:li:share:123"
        client.post.assert_awaited_once()
        assert client.post.call_args.args[0] == "https://api.linkedin.com/v2/ugcPosts"

    @pytest.mark.asyncio
    async def test_linkedin_api_error_maps_to_failed(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "linkedin_access_token", "tok")
        monkeypatch.setattr(oauth_adapters.settings, "linkedin_author_urn", "urn:li:organization:1")
        client = _mock_client(status_code=401, text="invalid token")

        with patch("gtm_api.services.publishing_adapters.oauth_adapters.httpx.AsyncClient", return_value=client):
            result = await oauth_adapters.linkedin_publish(_artifact(), MagicMock())

        assert result.status == "failed"
        assert "401" in result.error

    @pytest.mark.asyncio
    async def test_x_success(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "x_bearer_token", "tok")
        client = _mock_client(status_code=201, json_body={"data": {"id": "999", "text": "hi"}})

        with patch("gtm_api.services.publishing_adapters.oauth_adapters.httpx.AsyncClient", return_value=client):
            result = await oauth_adapters.x_publish(_artifact(), MagicMock())

        assert result.status == "published"
        assert result.provider_message_id == "999"

    @pytest.mark.asyncio
    async def test_medium_success(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "medium_access_token", "tok")
        monkeypatch.setattr(oauth_adapters.settings, "medium_author_id", "u1")
        client = _mock_client(status_code=201, json_body={"data": {"id": "post1", "url": "https://medium.com/p/1"}})

        with patch("gtm_api.services.publishing_adapters.oauth_adapters.httpx.AsyncClient", return_value=client):
            result = await oauth_adapters.medium_publish(_artifact(), MagicMock())

        assert result.status == "published"
        assert result.provider_message_id == "post1"
        assert "u1" in client.post.call_args.args[0]

    @pytest.mark.asyncio
    async def test_devto_success(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "devto_api_key", "key")
        client = _mock_client(status_code=201, json_body={"id": 42})

        with patch("gtm_api.services.publishing_adapters.oauth_adapters.httpx.AsyncClient", return_value=client):
            result = await oauth_adapters.devto_publish(_artifact(), MagicMock())

        assert result.status == "published"
        assert result.provider_message_id == "42"

    @pytest.mark.asyncio
    async def test_reddit_success(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "reddit_access_token", "tok")
        monkeypatch.setattr(oauth_adapters.settings, "reddit_subreddit", "test")
        client = _mock_client(status_code=200, json_body={"json": {"errors": [], "data": {"id": "abc123"}}})

        with patch("gtm_api.services.publishing_adapters.oauth_adapters.httpx.AsyncClient", return_value=client):
            result = await oauth_adapters.reddit_publish(_artifact(), MagicMock())

        assert result.status == "published"
        assert result.provider_message_id == "abc123"

    @pytest.mark.asyncio
    async def test_reddit_api_errors_map_to_failed(self, monkeypatch):
        monkeypatch.setattr(oauth_adapters.settings, "reddit_access_token", "tok")
        monkeypatch.setattr(oauth_adapters.settings, "reddit_subreddit", "test")
        client = _mock_client(status_code=200, json_body={"json": {"errors": [["RATELIMIT", "slow down"]], "data": {}}})

        with patch("gtm_api.services.publishing_adapters.oauth_adapters.httpx.AsyncClient", return_value=client):
            result = await oauth_adapters.reddit_publish(_artifact(), MagicMock())

        assert result.status == "failed"


class TestAdapterRegistryWiring:
    def test_registry_points_at_real_adapters_not_stubs(self):
        from gtm_api.services.publishing_adapters import ADAPTER_REGISTRY

        assert ADAPTER_REGISTRY["linkedin"] is oauth_adapters.linkedin_publish
        assert ADAPTER_REGISTRY["x"] is oauth_adapters.x_publish
        assert ADAPTER_REGISTRY["medium"] is oauth_adapters.medium_publish
        assert ADAPTER_REGISTRY["devto"] is oauth_adapters.devto_publish
        assert ADAPTER_REGISTRY["reddit"] is oauth_adapters.reddit_publish
