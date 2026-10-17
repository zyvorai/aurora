"""Compute the SEO block stored in ``Artifact.metadata_["seo"]`` (deterministic, no LLM)."""

from __future__ import annotations

from gtm_api.services.seo.content_score import score_content
from gtm_api.services.seo.schema import article_jsonld, suggest_meta


def seo_metadata(title: str, content: str, keyword: str, publisher: str = "") -> dict:
    meta = suggest_meta(title, content, keyword)
    score = score_content(content, keyword, meta["meta_title"], meta["meta_description"])
    return {
        "target_keyword": keyword,
        "meta_title": meta["meta_title"],
        "meta_description": meta["meta_description"],
        "score": score.score,
        "components": score.components,
        "suggestions": score.suggestions,
        "schema_jsonld": article_jsonld(title, meta["meta_description"], publisher=publisher),
    }
