"""SEO analysis: deterministic page audit and content scoring, keyword providers, JSON-LD.

Everything here is computed from the HTML or text it is given; nothing is fabricated. Keyword data
that is not measured by a provider is labelled ``source="estimate"``.
"""

from gtm_api.services.seo.audit import Finding, SeoAudit, audit_html
from gtm_api.services.seo.content_score import ContentScore, score_content
from gtm_api.services.seo.keywords import Keyword, get_provider
from gtm_api.services.seo.schema import article_jsonld, suggest_meta

__all__ = [
    "ContentScore",
    "Finding",
    "Keyword",
    "SeoAudit",
    "article_jsonld",
    "audit_html",
    "get_provider",
    "score_content",
    "suggest_meta",
]
