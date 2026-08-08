"""Playwright JS-render fallback for thin/SPA pages (Phase 1 roadmap item).

Playwright itself is an optional dependency (pip install playwright && playwright
install chromium) and is NOT installed in this test environment — these tests exercise
the config-gating and graceful-degradation behavior, and mock the playwright API surface
for the "it's installed and works" path rather than requiring a real browser.
"""

import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from gtm_api.services import crawler
from gtm_api.services.crawler import _render_with_playwright, fetch_single_page


class TestPlaywrightDisabledByDefault:
    @pytest.mark.asyncio
    async def test_returns_none_without_attempting_import_when_disabled(self, monkeypatch):
        monkeypatch.setattr(crawler.settings, "crawler_use_playwright", False)
        result = await _render_with_playwright("https://example.com")
        assert result is None


class TestPlaywrightNotInstalled:
    @pytest.mark.asyncio
    async def test_degrades_gracefully_when_package_missing(self, monkeypatch):
        monkeypatch.setattr(crawler.settings, "crawler_use_playwright", True)
        with patch.dict(sys.modules, {"playwright.async_api": None}):
            result = await _render_with_playwright("https://example.com")
        assert result is None


def _fake_playwright_module(html: str, raise_on_goto: Exception = None):
    """Build a fake playwright.async_api module exposing async_playwright() with the
    minimal chromium.launch().new_page().goto()/.content()/close() surface used by
    _render_with_playwright."""
    page = AsyncMock()
    if raise_on_goto:
        page.goto = AsyncMock(side_effect=raise_on_goto)
    else:
        page.goto = AsyncMock(return_value=None)
    page.content = AsyncMock(return_value=html)

    browser = AsyncMock()
    browser.new_page = AsyncMock(return_value=page)
    browser.close = AsyncMock(return_value=None)

    chromium = MagicMock()
    chromium.launch = AsyncMock(return_value=browser)

    playwright_instance = MagicMock()
    playwright_instance.chromium = chromium

    class _AsyncPlaywrightCtx:
        async def __aenter__(self):
            return playwright_instance

        async def __aexit__(self, *exc):
            return False

    module = types.ModuleType("playwright.async_api")
    module.async_playwright = MagicMock(return_value=_AsyncPlaywrightCtx())
    return module, browser


class TestPlaywrightRendersWhenAvailable:
    @pytest.mark.asyncio
    async def test_returns_rendered_html_and_closes_browser(self, monkeypatch):
        monkeypatch.setattr(crawler.settings, "crawler_use_playwright", True)
        fake_module, browser = _fake_playwright_module("<html><body>rendered</body></html>")

        with patch.dict(sys.modules, {"playwright.async_api": fake_module}):
            result = await _render_with_playwright("https://spa.example.com")

        assert result == "<html><body>rendered</body></html>"
        browser.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_navigation_error_returns_none_and_still_closes_browser(self, monkeypatch):
        monkeypatch.setattr(crawler.settings, "crawler_use_playwright", True)
        fake_module, browser = _fake_playwright_module("", raise_on_goto=TimeoutError("nav timeout"))

        with patch.dict(sys.modules, {"playwright.async_api": fake_module}):
            result = await _render_with_playwright("https://slow.example.com")

        assert result is None
        browser.close.assert_awaited_once()


class TestFetchSinglePageUsesPlaywrightFallbackForThinPages:
    @pytest.mark.asyncio
    async def test_thin_httpx_page_triggers_playwright_fallback(self, monkeypatch):
        monkeypatch.setattr(crawler.settings, "crawler_use_playwright", True)

        thin_html = "<html><body><div id='app'></div></body></html>"
        rendered_html = "<html><body>" + ("real content " * 40) + "</body></html>"

        mock_response = MagicMock()
        mock_response.text = thin_html
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("gtm_api.services.crawler.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]),
            patch("gtm_api.services.crawler.httpx.AsyncClient", return_value=mock_client),
            patch(
                "gtm_api.services.crawler._render_with_playwright",
                AsyncMock(return_value=rendered_html),
            ) as mock_render,
        ):
            page = await fetch_single_page("https://spa.example.com")

        mock_render.assert_awaited_once()
        assert "real content" in page.content

    @pytest.mark.asyncio
    async def test_substantial_httpx_page_never_calls_playwright(self, monkeypatch):
        monkeypatch.setattr(crawler.settings, "crawler_use_playwright", True)

        substantial_html = "<html><body>" + ("plenty of real server-rendered text " * 20) + "</body></html>"

        mock_response = MagicMock()
        mock_response.text = substantial_html
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with (
            patch("gtm_api.services.crawler.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]),
            patch("gtm_api.services.crawler.httpx.AsyncClient", return_value=mock_client),
            patch(
                "gtm_api.services.crawler._render_with_playwright", AsyncMock(return_value=None)
            ) as mock_render,
        ):
            await fetch_single_page("https://static.example.com")

        mock_render.assert_not_awaited()
