"""Regression tests for agent prompt templates (Python str.format placeholders)."""

from gtm_api.agents.marketing_strategy import STRATEGY_PROMPT
from gtm_api.agents.outreach import OUTREACH_PROMPT
from gtm_api.agents.product_understanding import EXTRACTION_PROMPT
from gtm_api.agents.proposal_generator import PROPOSAL_PROMPT
from gtm_api.agents.solution_architect import ARCHITECT_PROMPT


class TestAgentPrompts:
    def test_extraction_prompt_formats(self):
        result = EXTRACTION_PROMPT.format(product_name="Aurora", context="sample docs")
        assert "sample docs" in result
        assert "Aurora" in result
        assert "{question, answer}" in result

    def test_strategy_prompt_formats(self):
        result = STRATEGY_PROMPT.format(sources="rag, profile", context="docs")
        assert "docs" in result
        assert "{name, title, pain_points, goals, messaging}" in result

    def test_outreach_prompt_formats(self):
        result = OUTREACH_PROMPT.format(
            company_content="Acme Corp homepage",
            profile="{}",
            persona="CTO",
        )
        assert "CTO" in result
        assert "{day, subject, body}" in result

    def test_proposal_prompt_formats(self):
        result = PROPOSAL_PROMPT.format(
            sources="rag, crm",
            docs="docs",
            scope="Enterprise rollout",
            include_pricing=True,
        )
        assert "Enterprise rollout" in result

    def test_architect_prompt_formats(self):
        result = ARCHITECT_PROMPT.format(
            question="How does deployment work?",
            context="k8s",
            sources="rag, profile",
            docs="docs",
        )
        assert "How does deployment work?" in result
