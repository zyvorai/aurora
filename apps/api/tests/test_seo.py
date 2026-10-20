"""SEO audit, content scoring, keyword providers and WordPress adapter."""

import httpx
import pytest

from gtm_api.services.seo import article_jsonld, audit_html, score_content, suggest_meta
from gtm_api.services.seo.keywords import (
    DataForSEOProvider,
    GroundedProvider,
    SearchConsoleProvider,
    classify_intent,
    get_provider,
    mine_terms,
)

GOOD = """<!doctype html><html lang="en"><head>
<title>Storage control plane for Ceph, ZFS and NFS fleets</title>
<meta name="description" content="Atlas gives platform teams one API over Ceph, NFS and ZFS, with guarded changes and an audit trail for every action.">
<link rel="canonical" href="/storage"><meta name="viewport" content="width=device-width">
<meta property="og:title" content="x">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"x"}</script>
</head><body><h1>Storage control plane</h1><h2>Why</h2><h2>How</h2>
<p>%s</p><img src="a.png" alt="diagram"><a href="/docs">docs</a></body></html>""" % ("word " * 320)


def test_good_page_scores_high_with_no_critical_findings():
    a = audit_html(GOOD, "https://example.com/storage")
    assert a.score >= 95
    assert not [f for f in a.findings if f.severity == "critical"]
    assert a.jsonld_types == ["Article"] and a.has_open_graph and a.internal_links == 1


def test_bare_page_reports_critical_findings():
    a = audit_html("<html><body><p>hi</p></body></html>", "https://example.com/")
    ids = {f.id for f in a.findings}
    assert {"title.missing", "description.missing", "h1.missing", "content.thin"} <= ids
    assert a.score < 40


def test_noindex_and_alt_text_detected():
    html = '<html lang="en"><head><title>' + "t" * 40 + '</title><meta name="robots" content="noindex"></head><body><h1>a</h1><img src="x"><img src="y" alt="ok"></body></html>'
    a = audit_html(html, "https://example.com/")
    ids = {f.id for f in a.findings}
    assert "robots.noindex" in ids and "img.alt" in ids and a.images_missing_alt == 1


DRAFT = """# Storage control plane for platform teams

Storage control plane software gives teams one API. We explain how it works in practice and why it matters.

## Why a control plane
Body text that is long enough to be a real section. """ + "More useful detail here. " * 60 + """

## How to adopt it
See [docs](/docs) and [pricing](/pricing).
"""


def test_content_score_rewards_keyword_structure_and_meta():
    meta = suggest_meta("Storage control plane for platform teams", DRAFT, "storage control plane")
    s = score_content(DRAFT, "storage control plane", meta["meta_title"], meta["meta_description"])
    assert s.components["structure"] == 20 and s.components["links"] == 10
    assert s.components["keyword"] >= 17
    assert 0 < s.score <= 100


def test_content_score_flags_stuffing_and_missing_keyword():
    stuffed = "# kw\n\n" + "kw " * 100
    s = score_content(stuffed, "kw")
    assert any("stuffing" in x for x in s.suggestions)
    assert any("Choose a target keyword" in x for x in score_content(DRAFT, "").suggestions)


def test_suggest_meta_respects_limits_and_does_not_invent():
    m = suggest_meta("A" * 80, "First paragraph. " * 40)
    assert len(m["meta_title"]) <= 60 and len(m["meta_description"]) <= 160
    assert m["meta_description"].startswith("First paragraph.")


def test_jsonld_article_shape():
    d = article_jsonld("Head", "Desc", url="https://e.com/a", author="Acme")
    assert d["@type"] == "Article" and d["author"]["name"] == "Acme"


def test_intent_classification():
    assert classify_intent("storage pricing") == "transactional"
    assert classify_intent("best storage tools") == "commercial"
    assert classify_intent("how to tier storage") == "informational"


async def test_grounded_provider_labels_everything_an_estimate():
    corpus = ["ceph storage cluster management tools. ceph storage cluster upgrades"] * 2
    kws = await GroundedProvider().suggest("ceph storage", corpus, limit=5)
    assert kws and all(k.source == "estimate" and k.volume is None and k.difficulty is None for k in kws)
    assert "ceph storage" in [k.keyword for k in kws]
    assert mine_terms(["x"], "x") == []


async def test_dataforseo_provider_parses_volume(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"].startswith("Basic ")
        return httpx.Response(200, json={"tasks": [{"result": [
            {"keyword": "ceph storage", "search_volume": 1900, "competition_index": 42},
            {"keyword": "zfs pool", "search_volume": 880, "competition_index": 30},
        ]}]})

    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw))
    kws = await DataForSEOProvider("u", "p").suggest("ceph storage", ["ceph storage ceph storage"], limit=5)
    assert [k.keyword for k in kws] == ["ceph storage", "zfs pool"]
    assert kws[0].volume == 1900 and kws[0].difficulty == 42 and kws[0].source == "dataforseo"


async def test_search_console_provider_parses_rows(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer tok"
        assert "sc-domain%3Aexample.com" in str(request.url)
        return httpx.Response(200, json={"rows": [{"keys": ["ceph tuning"], "clicks": 12, "impressions": 400, "position": 8.26}]})

    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw))
    kws = await SearchConsoleProvider("tok", "sc-domain:example.com").suggest("", [], limit=5)
    assert kws[0].clicks == 12 and kws[0].position == 8.3 and kws[0].source == "search_console"


def test_provider_falls_back_to_grounded_without_credentials(monkeypatch):
    from gtm_api.config import get_settings
    monkeypatch.setenv("SEO_PROVIDER", "dataforseo")
    get_settings.cache_clear()
    try:
        assert get_provider().name == "estimate"
    finally:
        monkeypatch.delenv("SEO_PROVIDER")
        get_settings.cache_clear()


# ---- WordPress adapter -------------------------------------------------------------------------
from types import SimpleNamespace

from gtm_api.services.publishing_adapters import ADAPTER_REGISTRY, wordpress_adapter


def test_markdown_to_html_escapes_and_converts():
    out = wordpress_adapter.markdown_to_html("# T <b>\n\nHello **bold** [x](/a)\n\n- one\n- two\n<script>alert(1)</script>")
    assert "<h1>T &lt;b&gt;</h1>" in out and "<strong>bold</strong>" in out and '<a href="/a">x</a>' in out
    assert "<ul>" in out and "<li>two</li>" in out and "<script>" not in out


async def test_wordpress_not_configured_by_default():
    assert "wordpress" in ADAPTER_REGISTRY
    res = await wordpress_adapter.publish(SimpleNamespace(content="x", title="t", metadata_={}), SimpleNamespace())
    assert res.status == "not_configured"


async def test_wordpress_publishes_with_seo_block(monkeypatch):
    from gtm_api.config import get_settings
    monkeypatch.setenv("WORDPRESS_URL", "https://wp.example.com/")
    monkeypatch.setenv("WORDPRESS_USER", "bot")
    monkeypatch.setenv("WORDPRESS_APP_PASSWORD", "abcd efgh")
    get_settings.cache_clear()
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json as _json
        seen["url"] = str(request.url)
        seen["body"] = _json.loads(request.content)
        assert request.headers["authorization"].startswith("Basic ")
        return httpx.Response(201, json={"id": 77})

    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw))
    art = SimpleNamespace(
        content="# Head\n\nBody", title="Head",
        metadata_={"seo": {"meta_title": "Head | kw", "meta_description": "desc", "schema_jsonld": {"@type": "Article", "headline": "</script>"}}},
    )
    try:
        res = await wordpress_adapter.publish(art, SimpleNamespace())
    finally:
        for k in ("WORDPRESS_URL", "WORDPRESS_USER", "WORDPRESS_APP_PASSWORD"):
            monkeypatch.delenv(k)
        get_settings.cache_clear()
    assert res.status == "published" and res.provider_message_id == "77"
    assert seen["url"] == "https://wp.example.com/wp-json/wp/v2/posts"
    assert seen["body"]["title"] == "Head | kw" and seen["body"]["excerpt"] == "desc"
    assert "application/ld+json" in seen["body"]["content"] and "</script>\"" not in seen["body"]["content"].split("ld+json\">")[1].split("</script>")[0]


# ---- fetch_page: SSRF + redirect handling ------------------------------------------------------
from gtm_api.routers import seo as seo_router
from gtm_api.services.crawler import CrawlError


async def test_fetch_page_blocks_private_targets():
    with pytest.raises(CrawlError):
        await seo_router.fetch_page("http://127.0.0.1/admin")
    with pytest.raises(CrawlError):
        await seo_router.fetch_page("file:///etc/passwd")


async def test_fetch_page_validates_every_redirect_hop(monkeypatch):
    # first hop is "public"; the redirect points at a metadata address and must be refused
    monkeypatch.setattr(seo_router, "validate_url", lambda u: (_ for _ in ()).throw(CrawlError("blocked")) if "169.254" in u else u)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "http://169.254.169.254/latest"})

    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw))
    with pytest.raises(CrawlError):
        await seo_router.fetch_page("https://example.com/")


async def test_fetch_page_returns_html_and_enforces_status(monkeypatch):
    monkeypatch.setattr(seo_router, "validate_url", lambda u: u)
    state = {"code": 200}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(state["code"], text="<html></html>")

    transport = httpx.MockTransport(handler)
    real = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: real(transport=transport, **kw))
    assert await seo_router.fetch_page("https://example.com/") == "<html></html>"
    state["code"] = 404
    with pytest.raises(CrawlError):
        await seo_router.fetch_page("https://example.com/")
