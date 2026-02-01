"""
Test Shared Tools

Beads Task: intentvision-qd3.6

Tests for the shared tool profiles used by agents.
"""

import pytest
from unittest.mock import patch, MagicMock


class TestToolProfiles:
    """Test that each agent gets the correct tool profile."""

    def test_orchestrator_tools(self):
        """Orchestrator should get routing/delegation tools."""
        from agents.shared_tools import get_orchestrator_tools

        tools = get_orchestrator_tools()
        tool_names = [t.name for t in tools]

        # Orchestrator needs search and basic query tools
        assert "google_search" in tool_names
        assert "get_forecast" in tool_names
        assert "get_anomalies" in tool_names

        # Should NOT have alert/onboarding tools
        assert "get_alert_rules" not in tool_names
        assert "list_connectors" not in tool_names

    def test_metric_analyst_tools(self):
        """Metric analyst should get forecast/anomaly tools."""
        from agents.shared_tools import get_metric_analyst_tools

        tools = get_metric_analyst_tools()
        tool_names = [t.name for t in tools]

        assert "get_forecast" in tool_names
        assert "get_anomalies" in tool_names
        assert "get_metric_history" in tool_names

    def test_alert_tuner_tools(self):
        """Alert tuner should get alert management tools."""
        from agents.shared_tools import get_alert_tuner_tools

        tools = get_alert_tuner_tools()
        tool_names = [t.name for t in tools]

        assert "get_alert_rules" in tool_names
        assert "get_alert_history" in tool_names
        assert "get_metric_history" in tool_names

        # Should NOT have onboarding tools
        assert "list_connectors" not in tool_names

    def test_onboarding_coach_tools(self):
        """Onboarding coach should get connector/config tools."""
        from agents.shared_tools import get_onboarding_coach_tools

        tools = get_onboarding_coach_tools()
        tool_names = [t.name for t in tools]

        assert "list_connectors" in tool_names
        assert "run_pipeline" in tool_names
        assert "google_search" in tool_names


class TestToolFunctions:
    """Test individual tool implementations."""

    @patch("agents.shared_tools.intentvision_api.httpx")
    def test_get_forecast_calls_api(self, mock_httpx):
        """get_forecast should call IntentVision API."""
        from agents.shared_tools.intentvision_api import get_forecast

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "forecast": [],
            "backend": "statistical",
        }
        mock_response.raise_for_status = MagicMock()
        mock_httpx.get.return_value = mock_response

        result = get_forecast("org-123", "revenue.daily")

        # Verify API was called
        mock_httpx.get.assert_called_once()
        call_args = mock_httpx.get.call_args
        assert "forecast" in call_args[0][0]
        assert "org-123" in call_args[0][0]

    @patch("agents.shared_tools.intentvision_api.httpx")
    def test_get_anomalies_calls_api(self, mock_httpx):
        """get_anomalies should call IntentVision API."""
        from agents.shared_tools.intentvision_api import get_anomalies

        mock_response = MagicMock()
        mock_response.json.return_value = {"anomalies": []}
        mock_response.raise_for_status = MagicMock()
        mock_httpx.get.return_value = mock_response

        result = get_anomalies("org-123", "revenue.daily")

        mock_httpx.get.assert_called_once()
        call_args = mock_httpx.get.call_args
        assert "anomalies" in call_args[0][0]
