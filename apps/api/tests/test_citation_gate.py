"""Unit tests for citation gate and grounding."""

from gtm_api.services.citation_gate import (
    build_context_from_results,
    extract_citations_from_response,
    verify_grounding,
)
from gtm_api.services.vector_store import SearchResult


def _result(chunk_id: str, content: str, score: float = 0.9) -> SearchResult:
    return SearchResult(
        chunk_id=chunk_id,
        content=content,
        score=score,
        document_title="Docs",
        url="https://example.com/docs",
        metadata={},
    )


class TestCitationGate:
    def test_no_results_not_grounded(self):
        result = verify_grounding("Some answer", [])
        assert not result.grounded
        assert result.confidence == 0.0

    def test_with_results(self):
        results = [
            _result(
                "abc123",
                "Our product validates Kubernetes clusters automatically.",
                score=0.85,
            )
        ]
        answer = "Our product validates Kubernetes clusters automatically [Source 1]."
        result = verify_grounding(answer, results)
        assert result.grounded
        assert [c.chunk_id for c in result.citations] == ["abc123"]
        assert [c.status for c in result.claims] == ["supported"]

    def test_uncited_response_gets_no_fallback_citations(self):
        results = [_result("abc123", "Our product validates Kubernetes clusters automatically.")]
        answer = "Our product validates Kubernetes clusters automatically using Playwright tests."
        assert extract_citations_from_response(answer, results) == []
        result = verify_grounding(answer, results)
        assert not result.grounded
        assert result.citations == []

    def test_unsupported_claim_blocks_even_when_cited(self):
        results = [_result("c1", "The agent supports Linux hosts and runs as a systemd service.")]
        answer = (
            "The agent supports Linux hosts and runs as a systemd service [Source 1]. "
            "It also provides a fully managed disconnected deployment with offline licensing."
        )
        result = verify_grounding(answer, results)
        assert not result.grounded
        statuses = [c.status for c in result.claims]
        assert statuses == ["supported", "unsupported"]
        assert any("offline licensing" in b for b in result.blocked_claims)

    def test_conflicting_claim_detected(self):
        results = [_result("c1", "The product does not support Windows guests today.")]
        answer = "The product supports Windows guests today [Source 1]."
        result = verify_grounding(answer, results)
        assert not result.grounded
        assert result.claims[0].status == "conflicting"

    def test_source_number_out_of_range_is_not_a_citation(self):
        results = [_result("c1", "Feature X supports YAML configuration files.")]
        assert extract_citations_from_response("Feature X supports YAML [Source 7].", results) == []

    def test_high_retrieval_score_alone_is_not_grounding(self):
        results = [_result("c1", "Unrelated pricing text.", score=0.99)]
        result = verify_grounding("The platform encrypts every backup with hardware keys.", results)
        assert not result.grounded

    def test_build_context_includes_chunk_id(self):
        ctx = build_context_from_results([_result("abc123", "Feature X supports YAML.")])
        assert "abc123" in ctx
        assert "Feature X supports YAML." in ctx

    def test_extract_citations_by_chunk_id_in_response(self):
        results = [_result("chunk-1", "Our API supports webhooks for all events.")]
        citations = extract_citations_from_response(
            "Webhooks are supported (chunk-1).",
            results,
        )
        assert len(citations) == 1
        assert citations[0].chunk_id == "chunk-1"

    def test_abstention_without_citations_is_grounded(self):
        results = [_result("chunk-1", "Some doc content here.", score=0.8)]
        answer = "I don't have specific information about that in the product documentation."
        result = verify_grounding(answer, results)
        assert result.grounded

    def test_low_score_not_grounded(self):
        results = [_result("chunk-1", "Unrelated content.", score=0.1)]
        answer = "Completely fabricated claim about quantum pricing."
        result = verify_grounding(answer, results)
        assert not result.grounded
        assert result.blocked_claims
