"""
Shared Tools - Centralized Tool Profiles

Beads Task: intentvision-qd3.1

Following bobs-brain principle of least privilege:
each agent gets only the tools it needs.
"""

from .intentvision_api import (
    get_forecast_tool,
    get_anomalies_tool,
    get_metric_history_tool,
    get_alert_rules_tool,
    get_alert_history_tool,
    run_pipeline_tool,
    list_connectors_tool,
)
from .common import get_google_search_tool

# Tool profiles per agent
def get_orchestrator_tools():
    """Orchestrator tools: delegation, API queries"""
    return [
        get_google_search_tool(),
        get_forecast_tool(),
        get_anomalies_tool(),
    ]


def get_metric_analyst_tools():
    """Metric analyst tools: forecast/anomaly analysis"""
    return [
        get_forecast_tool(),
        get_anomalies_tool(),
        get_metric_history_tool(),
        get_google_search_tool(),
    ]


def get_alert_tuner_tools():
    """Alert tuner tools: alert rule management"""
    return [
        get_alert_rules_tool(),
        get_alert_history_tool(),
        get_metric_history_tool(),
    ]


def get_onboarding_coach_tools():
    """Onboarding coach tools: connector and config help"""
    return [
        list_connectors_tool(),
        run_pipeline_tool(),
        get_google_search_tool(),
    ]


__all__ = [
    "get_orchestrator_tools",
    "get_metric_analyst_tools",
    "get_alert_tuner_tools",
    "get_onboarding_coach_tools",
]
