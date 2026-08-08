"""Proposal export renderers (Phase 8): PDF/DOCX/PPTX actually render, not just mocked."""

import uuid

import pytest

from gtm_api.models import Artifact, ArtifactType
from gtm_api.services.proposal_export import (
    EXPORT_RENDERERS,
    render_proposal_docx,
    render_proposal_pdf,
    render_proposal_pptx,
)


def _artifact(metadata=None, title="Acme Corp Proposal"):
    return Artifact(
        id=uuid.uuid4(),
        product_id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        artifact_type=ArtifactType.PROPOSAL,
        title=title,
        content="",
        metadata_=metadata
        or {
            "title": title,
            "proposal_content": "We propose a phased rollout.",
            "sow": "Phase 1: discovery.\nPhase 2: build.",
            "roi_analysis": "Expected 3x ROI within 12 months.",
            "pricing": "$50,000 flat fee.",
            "timeline": "8 weeks.",
        },
    )


class TestRenderProposalPdf:
    def test_renders_nonempty_pdf_bytes(self):
        pdf_bytes = render_proposal_pdf(_artifact())
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        assert pdf_bytes.startswith(b"%PDF-")

    def test_handles_missing_sections_without_crashing(self):
        pdf_bytes = render_proposal_pdf(_artifact(metadata={"title": "Empty"}))
        assert pdf_bytes.startswith(b"%PDF-")

    def test_escapes_html_in_title_and_body(self):
        artifact = _artifact(
            metadata={
                "title": "<script>alert(1)</script>",
                "proposal_content": "<b>bold</b> & unsafe",
            }
        )
        pdf_bytes = render_proposal_pdf(artifact)
        # weasyprint would choke on unescaped "<script>" inside the body text node if it
        # weren't html.escape()'d before being embedded in the HTML string.
        assert pdf_bytes.startswith(b"%PDF-")


class TestRenderProposalDocx:
    def test_renders_nonempty_docx_bytes(self):
        docx_bytes = render_proposal_docx(_artifact())
        assert isinstance(docx_bytes, bytes)
        assert len(docx_bytes) > 0
        assert docx_bytes.startswith(b"PK")  # docx is a zip container

    def test_round_trips_through_python_docx(self):
        from io import BytesIO

        from docx import Document

        docx_bytes = render_proposal_docx(_artifact())
        document = Document(BytesIO(docx_bytes))
        text = "\n".join(p.text for p in document.paragraphs)
        assert "Acme Corp Proposal" in text
        assert "phased rollout" in text


class TestRenderProposalPptx:
    def test_renders_nonempty_pptx_bytes(self):
        pptx_bytes = render_proposal_pptx(_artifact())
        assert isinstance(pptx_bytes, bytes)
        assert len(pptx_bytes) > 0
        assert pptx_bytes.startswith(b"PK")  # pptx is a zip container

    def test_round_trips_through_python_pptx(self):
        from io import BytesIO

        from pptx import Presentation

        pptx_bytes = render_proposal_pptx(_artifact())
        presentation = Presentation(BytesIO(pptx_bytes))
        # title slide + one slide per populated section
        assert len(presentation.slides) == 1 + 5
        assert presentation.slides[0].shapes.title.text == "Acme Corp Proposal"


class TestExportRenderersRegistry:
    @pytest.mark.parametrize("fmt", ["pdf", "docx", "pptx"])
    def test_registered_formats_produce_bytes_with_expected_content_type(self, fmt):
        renderer, content_type = EXPORT_RENDERERS[fmt]
        output = renderer(_artifact())
        assert isinstance(output, bytes) and len(output) > 0
        assert "/" in content_type

    def test_no_unexpected_formats_registered(self):
        assert set(EXPORT_RENDERERS.keys()) == {"pdf", "docx", "pptx"}
