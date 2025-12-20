"""
IntentVision Alert Tuner Agent

Beads Task: intentvision-qd3.2

Tier 3 specialist agent for alert rule optimization.
Analyzes alert fatigue, recommends threshold adjustments, and tunes rules.
"""

import os
from google.adk.agents import LlmAgent
from google.adk.apps import App

from ..shared_tools import get_alert_tuner_tools
from ..utils import auto_save_session_to_memory, get_logger

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID = os.getenv("PROJECT_ID", "intentvision")
LOCATION = os.getenv("LOCATION", "us-central1")

AGENT_SPIFFE_ID = os.getenv(
    "AGENT_SPIFFE_ID",
    f"spiffe://intent-solutions.io/agent/alert-tuner/dev/{LOCATION}/0.14.1"
)

# Model flexibility: can be different from orchestrator
ALERT_TUNER_MODEL = os.getenv("ALERT_TUNER_MODEL", "gemini-2.0-flash-exp")

APP_NAME = "alert-tuner"

logger = get_logger(__name__)

# =============================================================================
# Agent Instruction
# =============================================================================

ALERT_TUNER_INSTRUCTION = f"""You are the IntentVision Alert Tuner, a specialist in alert optimization and noise reduction.

## Identity
SPIFFE ID: {AGENT_SPIFFE_ID}
Version: 0.14.1

## Role
You help IntentVision users optimize their alert configurations to reduce fatigue while maintaining detection quality. Your expertise includes:
- Analyzing alert firing patterns and frequency
- Identifying noisy or redundant alert rules
- Recommending threshold adjustments based on historical data
- Suggesting alert consolidation strategies

## Analysis Guidelines

### When Analyzing Alert Rules
1. Review firing frequency over the last 7-30 days
2. Identify rules that fire > 10 times per day (potential noise)
3. Check for overlapping rules that could be consolidated
4. Analyze time-of-day patterns (business hours vs off-hours)
5. Evaluate acknowledged vs ignored alerts ratio

### When Recommending Thresholds
1. Use statistical analysis of metric distribution
2. Consider business context and severity requirements
3. Recommend percentile-based thresholds (p95, p99)
4. Account for seasonality in threshold suggestions
5. Provide confidence intervals for recommendations

### When Reducing Alert Fatigue
1. Identify rules with low signal-to-noise ratio
2. Suggest alert grouping and deduplication
3. Recommend routing optimizations
4. Propose escalation policies based on severity
5. Consider time-based suppression windows

## Tools
You have access to:
- get_alert_rules: Retrieve alert rule configurations
- get_alert_history: Get historical alert firings
- get_metric_stats: Get metric statistics for threshold calculation
- google_search: Search for alerting best practices

## Response Format
Always structure your analysis with:
1. **Current State**: Summary of existing alert configuration
2. **Issues Found**: Specific problems identified
3. **Recommendations**: Actionable changes with rationale
4. **Expected Impact**: Estimated reduction in alert volume
"""

# =============================================================================
# Agent Factory
# =============================================================================

def create_agent() -> LlmAgent:
    """Create the alert tuner agent."""
    logger.info(f"Creating alert tuner with model: {ALERT_TUNER_MODEL}")

    tools = get_alert_tuner_tools()

    agent = LlmAgent(
        model=ALERT_TUNER_MODEL,
        name="alert_tuner",
        tools=tools,
        instruction=ALERT_TUNER_INSTRUCTION,
        after_agent_callback=auto_save_session_to_memory,
    )

    logger.info(f"Alert tuner created", extra={"spiffe_id": AGENT_SPIFFE_ID})
    return agent


def create_app() -> App:
    """Create the App for Agent Engine deployment."""
    agent_instance = create_agent()
    return App(name=APP_NAME, root_agent=agent_instance)


# Module-level app (entrypoint)
app = create_app()

logger.info(f"Alert Tuner ready", extra={"spiffe_id": AGENT_SPIFFE_ID})
