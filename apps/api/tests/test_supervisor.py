"""Unit tests for multi-agent supervisor routing."""

import pytest

from gtm_api.agents.supervisor import route_request


class TestSupervisorRouting:
    @pytest.mark.parametrize(
        "request_type,expected",
        [
            ("ingest", "discovery"),
            ("understand", "discovery"),
            ("query", "sales"),
            ("chat", "sales"),
            ("strategy", "marketing"),
            ("content", "content"),
            ("outreach", "outreach"),
            ("architect", "solution"),
            ("proposal", "proposal"),
            ("analytics", "analytics"),
            ("refresh", "learning"),
            ("publish", "content"),
        ],
    )
    def test_routes_request_types(self, request_type, expected):
        state = {"request_type": request_type, "routed_agent": ""}
        assert route_request(state) == expected
        assert state["routed_agent"] == expected

    def test_unknown_request_defaults_to_sales(self):
        state = {"request_type": "unknown_action", "routed_agent": ""}
        assert route_request(state) == "sales"
