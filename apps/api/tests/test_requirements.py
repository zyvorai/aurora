"""Requirement-to-proof: extraction, verdict enforcement, response document, workspace summary."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from gtm_api.routers.deals import _summarise
from gtm_api.services.requirements import (
    assess_requirement,
    build_response_document,
    extract_requirements,
    finalize_verdict,
    split_requirements_heuristic,
)
from gtm_api.services.vector_store import SearchResult


def _r(chunk_id, content, score=0.9):
    return SearchResult(chunk_id=chunk_id, content=content, score=score,
                        document_title="Docs", url="https://x/docs", metadata={})


class TestHeuristicSplit:
    def test_bullets_numbering_and_dedupe(self):
        text = """
        1. The platform must support Windows guest operating systems.
        - Deployment shall work in a disconnected environment.
        (3) The platform must support Windows guest operating systems.
        short
        """
        out = split_requirements_heuristic(text)
        assert out == [
            "The platform must support Windows guest operating systems.",
            "Deployment shall work in a disconnected environment.",
        ]

    def test_splits_sentences_on_one_line(self):
        out = split_requirements_heuristic("We need SSO via OIDC. We need audit logs for all changes.")
        assert len(out) == 2


@pytest.mark.asyncio
async def test_extract_falls_back_when_llm_fails():
    with patch("gtm_api.services.requirements.get_chat_model", side_effect=RuntimeError("down")):
        out = await extract_requirements("- The system must export audit logs to our SIEM.")
    assert out == ["The system must export audit logs to our SIEM."]


@pytest.mark.asyncio
async def test_extract_uses_llm_split_of_compound_requirement():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(return_value=SimpleNamespace(
        content='```json\n["Support Windows workloads", "Support disconnected deployment", "Support our storage backend"]\n```'
    ))
    with patch("gtm_api.services.requirements.get_chat_model", return_value=llm):
        out = await extract_requirements("Can you support Windows, disconnected deployment and our storage backend?")
    assert len(out) == 3


RESULTS = [_r("c1", "The agent supports Windows Server 2019 and 2022 guests.")]


class TestFinalizeVerdict:
    results = RESULTS

    def test_cited_supported_claim_stays_supported(self):
        d = finalize_verdict({"verdict": "supported"},
                             "The agent supports Windows Server 2019 and 2022 guests [Source 1].", self.results)
        assert d.verdict == "supported"
        assert d.citations[0]["chunk_id"] == "c1" and d.confidence > 0

    def test_uncited_answer_is_downgraded_to_unknown(self):
        d = finalize_verdict({"verdict": "supported"},
                             "It provides fully managed offline licensing for air-gapped sites.", self.results)
        assert d.verdict == "unknown" and d.confidence == 0.0

    def test_roadmap_wording_in_cited_passage_forces_roadmap(self):
        res = [_r("c2", "Disconnected deployment is planned for a future release.")]
        d = finalize_verdict({"verdict": "supported"},
                             "Disconnected deployment is planned for a future release [Source 1].", res)
        assert d.verdict == "roadmap"

    def test_no_results_is_unknown(self):
        assert finalize_verdict({"verdict": "supported"}, "anything", []).verdict == "unknown"

    def test_invalid_verdict_becomes_unknown(self):
        d = finalize_verdict({"verdict": "definitely"},
                             "The agent supports Windows Server 2019 and 2022 guests [Source 1].", self.results)
        assert d.verdict == "unknown"


@pytest.mark.asyncio
async def test_assess_with_no_results_skips_llm():
    with patch("gtm_api.services.requirements.get_chat_model") as get_model:
        d = await assess_requirement("anything at all here", [])
    get_model.assert_not_called()
    assert d.verdict == "unknown"


@pytest.mark.asyncio
async def test_assess_non_json_reply_is_unknown():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(return_value=SimpleNamespace(content="Sure! It works great."))
    with patch("gtm_api.services.requirements.get_chat_model", return_value=llm):
        d = await assess_requirement("must support Windows", [_r("c1", "Windows is supported.")])
    assert d.verdict == "unknown"


def test_response_document_sections_and_roadmap_label():
    doc = build_response_document([
        {"requirement": "Windows guests", "verdict": "supported", "answer": "Supported [Source 1].",
         "conditions": "", "validation_test": "Boot a Windows 2022 VM"},
        {"requirement": "Air-gapped install", "verdict": "roadmap", "answer": "Planned.",
         "conditions": "", "validation_test": ""},
        {"requirement": "Tape backend", "verdict": "unknown", "answer": "invented text",
         "conditions": "", "validation_test": ""},
    ])
    assert "## Supported" in doc and "Roadmap (not available today)" in doc
    assert "We are confirming this" in doc and "invented text" not in doc
    assert "Suggested validation:* Boot a Windows 2022 VM" in doc


def _proof(verdict, review="pending", stale=None):
    return SimpleNamespace(verdict=verdict, review_status=review, stale_reason=stale)


def test_summary_and_next_actions():
    reqs = [SimpleNamespace(id=uuid.uuid4()) for _ in range(5)]
    latest = {
        reqs[0].id: _proof("supported", "approved"),
        reqs[1].id: _proof("gap"),
        reqs[2].id: _proof("roadmap", stale="source_changed"),
        reqs[3].id: _proof("unknown"),
    }
    summary, actions = _summarise(reqs, latest)
    assert summary["total"] == 5 and summary["unanalyzed"] == 1
    assert summary["approved"] == 1 and summary["stale"] == 1
    joined = " ".join(actions)
    assert "Analyze 1" in joined and "Re-analyze 1" in joined and "Review 2" in joined
    assert "2 gap/unknown" in joined and "roadmap" in joined


def test_deals_routes_registered():
    from gtm_api.main import app

    paths = set(app.openapi()["paths"])
    base = "/api/v1/products/{product_id}/opportunities/{opportunity_id}"
    for suffix in ("/requirements", "/requirements/analyze", "/workspace",
                   "/requirements/{requirement_id}/review", "/requirements/response"):
        assert base + suffix in paths, suffix
