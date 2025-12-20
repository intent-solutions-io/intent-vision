"""
Pytest Configuration for IntentVision ADK Tests

Beads Task: intentvision-qd3.6
"""

import os
import pytest
from pathlib import Path

# Set test environment variables
os.environ.setdefault("PROJECT_ID", "intentvision-test")
os.environ.setdefault("LOCATION", "us-central1")
os.environ.setdefault("ENV", "test")
os.environ.setdefault("INTENTVISION_API_URL", "http://localhost:8080")


@pytest.fixture
def adk_root() -> Path:
    """Return the ADK root directory."""
    return Path(__file__).parent.parent


@pytest.fixture
def sample_org_id() -> str:
    """Return a sample organization ID for testing."""
    return "test-org-123"


@pytest.fixture
def sample_metric_key() -> str:
    """Return a sample metric key for testing."""
    return "revenue.daily"


@pytest.fixture
def sample_forecast_response() -> dict:
    """Return a sample forecast response."""
    return {
        "metric_key": "revenue.daily",
        "org_id": "test-org-123",
        "forecast": [
            {"timestamp": "2024-01-01T00:00:00Z", "value": 1000, "lower": 900, "upper": 1100},
            {"timestamp": "2024-01-02T00:00:00Z", "value": 1050, "lower": 950, "upper": 1150},
            {"timestamp": "2024-01-03T00:00:00Z", "value": 1100, "lower": 1000, "upper": 1200},
        ],
        "backend": "statistical",
        "horizon": 7,
    }


@pytest.fixture
def sample_anomaly_response() -> dict:
    """Return a sample anomaly response."""
    return {
        "anomalies": [
            {
                "id": "anomaly-001",
                "metric_key": "revenue.daily",
                "timestamp": "2024-01-15T00:00:00Z",
                "value": 500,
                "expected_value": 1000,
                "severity": "high",
                "detected_at": "2024-01-15T01:00:00Z",
            }
        ],
        "total": 1,
    }


@pytest.fixture
def sample_alert_rules() -> list:
    """Return sample alert rules."""
    return [
        {
            "id": "rule-001",
            "metric_key": "revenue.daily",
            "condition": "below_threshold",
            "threshold": 800,
            "severity": "high",
            "enabled": True,
        },
        {
            "id": "rule-002",
            "metric_key": "users.active",
            "condition": "anomaly_detected",
            "severity": "medium",
            "enabled": True,
        },
    ]
