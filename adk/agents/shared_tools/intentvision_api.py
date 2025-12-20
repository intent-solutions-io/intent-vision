"""
IntentVision API Tools - Tools that call the IntentVision HTTP API

Beads Task: intentvision-qd3.1

These tools wrap HTTP calls to the IntentVision Node.js API,
allowing ADK agents to interact with the core platform.
"""

import os
from typing import Dict, List, Optional
from google.adk.agents import FunctionTool
import httpx

# Configuration
INTENTVISION_API_URL = os.getenv(
    "INTENTVISION_API_URL",
    "https://intentvision.intent-solutions.io"
)
INTENTVISION_API_KEY = os.getenv("INTENTVISION_API_KEY", "")


def _get_headers() -> Dict[str, str]:
    """Get API headers with authentication"""
    return {
        "X-API-Key": INTENTVISION_API_KEY,
        "Content-Type": "application/json",
    }


# =============================================================================
# Forecast Tools
# =============================================================================

def get_forecast(
    org_id: str,
    metric_key: str,
    horizon: int = 7,
    backend: str = "statistical"
) -> Dict:
    """
    Get forecast for a metric from IntentVision API.

    Args:
        org_id: Organization ID
        metric_key: Metric key to forecast
        horizon: Forecast horizon in days
        backend: Forecast backend ("statistical" or "timegpt")

    Returns:
        Forecast data including predictions and confidence intervals
    """
    try:
        response = httpx.get(
            f"{INTENTVISION_API_URL}/v1/forecast/{org_id}/{metric_key}",
            params={"horizon": horizon, "backend": backend},
            headers=_get_headers(),
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e), "success": False}


def get_forecast_tool():
    return FunctionTool(
        func=get_forecast,
        name="get_forecast",
        description="Get forecast predictions for a metric from IntentVision"
    )


# =============================================================================
# Anomaly Tools
# =============================================================================

def get_anomalies(
    org_id: str,
    metric_key: Optional[str] = None,
    time_range: str = "7d",
    min_severity: str = "warning"
) -> Dict:
    """
    Get detected anomalies from IntentVision API.

    Args:
        org_id: Organization ID
        metric_key: Optional specific metric key
        time_range: Time range to query (e.g., "1h", "7d", "30d")
        min_severity: Minimum severity level ("info", "warning", "error", "critical")

    Returns:
        List of detected anomalies with details
    """
    try:
        params = {"time_range": time_range, "min_severity": min_severity}
        if metric_key:
            params["metric_key"] = metric_key

        response = httpx.get(
            f"{INTENTVISION_API_URL}/v1/anomalies/{org_id}",
            params=params,
            headers=_get_headers(),
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e), "success": False, "anomalies": []}


def get_anomalies_tool():
    return FunctionTool(
        func=get_anomalies,
        name="get_anomalies",
        description="Get detected anomalies for an organization or specific metric"
    )


# =============================================================================
# Metric Tools
# =============================================================================

def get_metric_history(
    org_id: str,
    metric_key: str,
    time_range: str = "7d"
) -> Dict:
    """
    Get historical metric data from IntentVision API.

    Args:
        org_id: Organization ID
        metric_key: Metric key to query
        time_range: Time range (e.g., "1h", "7d", "30d")

    Returns:
        Historical metric values with timestamps
    """
    try:
        response = httpx.get(
            f"{INTENTVISION_API_URL}/v1/metrics/{org_id}/{metric_key}/history",
            params={"time_range": time_range},
            headers=_get_headers(),
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e), "success": False, "values": []}


def get_metric_history_tool():
    return FunctionTool(
        func=get_metric_history,
        name="get_metric_history",
        description="Get historical values for a metric over a time range"
    )


# =============================================================================
# Alert Tools
# =============================================================================

def get_alert_rules(org_id: str) -> Dict:
    """
    Get alert rules for an organization.

    Args:
        org_id: Organization ID

    Returns:
        List of configured alert rules
    """
    try:
        response = httpx.get(
            f"{INTENTVISION_API_URL}/v1/alerts/{org_id}/rules",
            headers=_get_headers(),
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e), "success": False, "rules": []}


def get_alert_rules_tool():
    return FunctionTool(
        func=get_alert_rules,
        name="get_alert_rules",
        description="Get configured alert rules for an organization"
    )


def get_alert_history(
    org_id: str,
    rule_id: Optional[str] = None,
    time_range: str = "30d"
) -> Dict:
    """
    Get alert firing history.

    Args:
        org_id: Organization ID
        rule_id: Optional specific rule ID
        time_range: Time range to query

    Returns:
        List of alert events
    """
    try:
        params = {"time_range": time_range}
        if rule_id:
            params["rule_id"] = rule_id

        response = httpx.get(
            f"{INTENTVISION_API_URL}/v1/alerts/{org_id}/history",
            params=params,
            headers=_get_headers(),
            timeout=30.0
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e), "success": False, "events": []}


def get_alert_history_tool():
    return FunctionTool(
        func=get_alert_history,
        name="get_alert_history",
        description="Get alert firing history for an organization"
    )


# =============================================================================
# Pipeline Tools
# =============================================================================

def run_pipeline(
    org_id: str,
    use_synthetic: bool = True
) -> Dict:
    """
    Trigger a pipeline run for an organization.

    Args:
        org_id: Organization ID
        use_synthetic: Whether to use synthetic data

    Returns:
        Pipeline run status and results
    """
    try:
        response = httpx.post(
            f"{INTENTVISION_API_URL}/v1/pipeline/{org_id}/run",
            json={"use_synthetic": use_synthetic},
            headers=_get_headers(),
            timeout=60.0
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e), "success": False}


def run_pipeline_tool():
    return FunctionTool(
        func=run_pipeline,
        name="run_pipeline",
        description="Trigger an IntentVision pipeline run for an organization"
    )


# =============================================================================
# Connector Tools
# =============================================================================

def list_connectors() -> Dict:
    """
    List available data connectors.

    Returns:
        List of supported connector types with configuration schemas
    """
    # This returns static connector info - could be made dynamic
    return {
        "success": True,
        "connectors": [
            {
                "type": "stripe",
                "name": "Stripe",
                "description": "Connect to Stripe for revenue metrics",
                "config_schema": {
                    "api_key": {"type": "string", "required": True},
                    "metrics": {"type": "array", "items": ["mrr", "arr", "churn"]}
                }
            },
            {
                "type": "posthog",
                "name": "PostHog",
                "description": "Connect to PostHog for product analytics",
                "config_schema": {
                    "api_key": {"type": "string", "required": True},
                    "project_id": {"type": "string", "required": True}
                }
            },
            {
                "type": "webhook",
                "name": "Webhook",
                "description": "Receive metrics via HTTP webhook",
                "config_schema": {
                    "endpoint": {"type": "string", "auto_generated": True}
                }
            },
            {
                "type": "csv",
                "name": "CSV Upload",
                "description": "Upload historical data via CSV",
                "config_schema": {
                    "format": {"type": "string", "enum": ["time_value", "pivot"]}
                }
            }
        ]
    }


def list_connectors_tool():
    return FunctionTool(
        func=list_connectors,
        name="list_connectors",
        description="List available data connectors for metric ingestion"
    )
