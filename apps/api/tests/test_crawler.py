"""Unit tests for SSRF-safe crawler."""

import socket
from unittest.mock import patch

import pytest

from gtm_api.services.crawler import CrawlError, extract_links, extract_text, validate_url


class TestValidateUrl:
    @patch("gtm_api.services.crawler.socket.getaddrinfo")
    def test_allows_public_https_url(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))
        ]
        url = validate_url("https://example.com/docs")
        assert url == "https://example.com/docs"

    def test_blocks_localhost_hostname(self):
        with pytest.raises(CrawlError, match="Blocked hostname"):
            validate_url("http://localhost/admin")

    def test_blocks_loopback_ip(self):
        with pytest.raises(CrawlError, match="Blocked IP"):
            validate_url("http://127.0.0.1/secret")

    def test_blocks_private_ip_192_168(self):
        with pytest.raises(CrawlError, match="Blocked IP"):
            validate_url("http://192.168.1.1/internal")

    def test_blocks_file_scheme(self):
        with pytest.raises(CrawlError, match="Invalid scheme"):
            validate_url("file:///etc/passwd")

    def test_blocks_missing_host(self):
        with pytest.raises(CrawlError, match="no host"):
            validate_url("https:///path-only")


class TestExtractContent:
    def test_extract_text_strips_scripts_and_gets_title(self):
        html = """
        <html><head><title>Product Docs</title></head>
        <body><script>evil()</script><p>Hello world</p></body></html>
        """
        title, text = extract_text(html)
        assert title == "Product Docs"
        assert "Hello world" in text
        assert "evil" not in text

    def test_extract_links_same_domain_only(self):
        html = """
        <a href="/docs">Internal</a>
        <a href="https://evil.com/phish">External</a>
        """
        links = extract_links(html, "https://example.com/page")
        assert links == ["https://example.com/docs"]
