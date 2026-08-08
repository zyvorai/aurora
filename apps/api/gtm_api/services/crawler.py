"""Secure web crawler with SSRF protection."""

import hashlib
import ipaddress
import re
import socket
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
import structlog
from bs4 import BeautifulSoup

from gtm_api.config import get_settings

settings = get_settings()
logger = structlog.get_logger()

BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


@dataclass
class CrawledPage:
    url: str
    title: str
    content: str
    content_hash: str
    links: list[str]


class CrawlError(Exception):
    pass


def _is_blocked_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in network for network in BLOCKED_NETWORKS)
    except ValueError:
        return True


def validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise CrawlError(f"Invalid scheme: {parsed.scheme}")
    if not parsed.netloc:
        raise CrawlError("Invalid URL: no host")

    hostname = parsed.hostname
    if not hostname:
        raise CrawlError("Invalid URL: no hostname")

    if hostname in ("localhost", "metadata.google.internal"):
        raise CrawlError(f"Blocked hostname: {hostname}")

    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for info in addr_info:
            ip = info[4][0]
            if _is_blocked_ip(ip):
                raise CrawlError(f"Blocked IP address: {ip}")
    except socket.gaierror as exc:
        raise CrawlError(f"DNS resolution failed: {hostname}") from exc

    return url


def extract_text(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    text = soup.get_text(separator="\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return title, text


def extract_links(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    links = []
    base_domain = urlparse(base_url).netloc
    for a in soup.find_all("a", href=True):
        href = a["href"]
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        if parsed.scheme in ("http", "https") and parsed.netloc == base_domain:
            clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if clean not in links:
                links.append(clean)
    return links


async def _render_with_playwright(url: str) -> Optional[str]:
    """Best-effort JS-rendered fetch for SPA/JS-heavy pages. Returns None (never raises)
    on any failure — playwright not installed, browser not installed, navigation error,
    timeout — so callers always have the plain httpx-fetched page as a safe fallback."""
    if not settings.crawler_use_playwright:
        return None
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("playwright_not_installed", url=url)
        return None

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page(user_agent=settings.crawl_user_agent)
                await page.goto(
                    url,
                    timeout=settings.crawler_playwright_timeout_ms,
                    wait_until="networkidle",
                )
                return await page.content()
            finally:
                await browser.close()
    except Exception as exc:
        logger.warning("playwright_render_failed", url=url, error=str(exc))
        return None


async def crawl_website(
    start_url: str,
    max_pages: Optional[int] = None,
) -> list[CrawledPage]:
    max_pages = max_pages or settings.crawl_max_pages
    start_url = validate_url(start_url)
    visited: set[str] = set()
    queue: list[str] = [start_url]
    pages: list[CrawledPage] = []

    async with httpx.AsyncClient(
        timeout=settings.crawl_timeout_seconds,
        follow_redirects=True,
        headers={"User-Agent": settings.crawl_user_agent},
    ) as client:
        while queue and len(pages) < max_pages:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                validate_url(url)
                response = await client.get(url)
                if response.status_code != 200:
                    continue
                content_type = response.headers.get("content-type", "")
                if "text/html" not in content_type:
                    continue

                title, text = extract_text(response.text)
                links = extract_links(response.text, url)

                if len(text.strip()) < settings.crawler_thin_page_char_threshold:
                    rendered_html = await _render_with_playwright(url)
                    if rendered_html:
                        title, text = extract_text(rendered_html)
                        links = extract_links(rendered_html, url)

                if len(text.strip()) < 50:
                    continue

                content_hash = hashlib.sha256(text.encode()).hexdigest()

                pages.append(
                    CrawledPage(
                        url=url,
                        title=title,
                        content=text[:50000],
                        content_hash=content_hash,
                        links=links,
                    )
                )

                for link in links:
                    if link not in visited:
                        queue.append(link)

            except (CrawlError, httpx.HTTPError):
                continue

    return pages


async def fetch_single_page(url: str) -> CrawledPage:
    url = validate_url(url)
    async with httpx.AsyncClient(
        timeout=settings.crawl_timeout_seconds,
        follow_redirects=True,
        headers={"User-Agent": settings.crawl_user_agent},
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        title, text = extract_text(response.text)

        if len(text.strip()) < settings.crawler_thin_page_char_threshold:
            rendered_html = await _render_with_playwright(url)
            if rendered_html:
                title, text = extract_text(rendered_html)

        content_hash = hashlib.sha256(text.encode()).hexdigest()
        return CrawledPage(
            url=url,
            title=title,
            content=text[:50000],
            content_hash=content_hash,
            links=[],
        )
