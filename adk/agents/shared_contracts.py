"""
Shared Contracts - A2A Data Contracts for IntentVision Agents

Beads Task: intentvision-qd3.1

These dataclasses define the input/output contracts for A2A communication
between the orchestrator and specialist agents.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Literal
from datetime import datetime
import uuid


# =============================================================================
# Orchestrator Contracts
# =============================================================================

@dataclass
class AgentTaskRequest:
    """Base request for all agent tasks"""
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str = ""
    user_query: str = ""
    context: Dict = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class AgentTaskResponse:
    """Base response for all agent tasks"""
    task_id: str = ""
    success: bool = True
    result: Dict = field(default_factory=dict)
    error: Optional[str] = None
    duration_ms: int = 0
    agent_name: str = ""


# =============================================================================
# Metric Analyst Contracts
# =============================================================================

@dataclass
class ExplainForecastRequest:
    """Request to explain a forecast"""
    org_id: str
    metric_key: str
    time_range: str = "7d"
    include_anomalies: bool = True
    include_recommendations: bool = True


@dataclass
class ForecastExplanation:
    """Forecast explanation response"""
    metric_key: str
    explanation: str
    confidence: float
    trend: Literal["increasing", "decreasing", "stable", "volatile"]
    forecast_values: List[Dict]
    anomalies: List[Dict]
    recommendations: List[str]
    backend_used: str  # "statistical" or "timegpt"


@dataclass
class CompareBackendsRequest:
    """Request to compare forecast backends"""
    org_id: str
    metric_key: str
    backends: List[str] = field(default_factory=lambda: ["statistical", "timegpt"])


@dataclass
class BackendComparison:
    """Backend comparison response"""
    metric_key: str
    comparisons: Dict[str, Dict]  # backend -> metrics
    recommendation: str
    winner: str


# =============================================================================
# Alert Tuner Contracts
# =============================================================================

@dataclass
class TuneAlertRequest:
    """Request to tune an alert rule"""
    org_id: str
    alert_rule_id: str
    analysis_period: str = "30d"
    target_noise_reduction: float = 0.3  # 30% reduction


@dataclass
class AlertTuningRecommendation:
    """Alert tuning recommendation"""
    alert_rule_id: str
    current_threshold: float
    recommended_threshold: float
    rationale: str
    expected_noise_reduction: float
    false_positive_rate: float
    preview_alerts: List[Dict]  # What alerts would have fired with new threshold


@dataclass
class AnalyzeNoiseRequest:
    """Request to analyze noisy alerts"""
    org_id: str
    time_range: str = "7d"
    min_frequency: int = 10  # Minimum firings to consider noisy


@dataclass
class NoiseAnalysis:
    """Noise analysis response"""
    noisy_alerts: List[Dict]
    suppression_recommendations: List[Dict]
    total_alert_count: int
    noise_percentage: float


# =============================================================================
# Onboarding Coach Contracts
# =============================================================================

@dataclass
class OnboardMetricRequest:
    """Request to help onboard a new metric"""
    org_id: str
    source_type: str  # "stripe", "posthog", "datadog", "custom"
    source_schema: Dict  # Sample of the source data
    description: str  # User description of what they want to track


@dataclass
class MetricMappingSuggestion:
    """Metric mapping suggestion"""
    suggested_metric_key: str
    canonical_type: str  # "gauge", "counter", "histogram"
    dimension_mappings: Dict[str, str]
    transformation: Optional[str]  # Optional transformation expression
    validation_result: Dict
    confidence: float


@dataclass
class ValidateConfigRequest:
    """Request to validate an ingestion configuration"""
    org_id: str
    config: Dict  # The proposed configuration


@dataclass
class ConfigValidation:
    """Configuration validation result"""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    suggestions: List[str]
