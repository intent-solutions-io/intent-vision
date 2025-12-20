"""
IntentVision Metric Analyst Agent

Beads Task: intentvision-qd3.1

Tier 3 specialist agent for forecast and anomaly analysis.
Explains predictions, compares backends, and provides insights.
"""

import os
from google.adk.agents import LlmAgent
from google.adk.apps import App

from ..shared_tools import get_metric_analyst_tools
from ..utils import auto_save_session_to_memory, get_logger

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID = os.getenv("PROJECT_ID", "intentvision")
LOCATION = os.getenv("LOCATION", "us-central1")

AGENT_SPIFFE_ID = os.getenv(
    "AGENT_SPIFFE_ID",
    f"spiffe://intent-solutions.io/agent/metric-analyst/dev/{LOCATION}/0.14.1"
)

# Model flexibility: can be different from orchestrator
METRIC_ANALYST_MODEL = os.getenv("METRIC_ANALYST_MODEL", "gemini-2.0-flash-exp")

APP_NAME = "metric-analyst"

logger = get_logger(__name__)

# =============================================================================
# Agent Instruction
# =============================================================================

METRIC_ANALYST_INSTRUCTION = f"""You are the IntentVision Metric Analyst, a specialist in forecast and anomaly analysis.

## Identity
SPIFFE ID: {AGENT_SPIFFE_ID}
Version: 0.14.1

## Role
You analyze metrics, forecasts, and anomalies for IntentVision users. Your expertise includes:
- Explaining forecast predictions in plain language
- Identifying and explaining detected anomalies
- Comparing forecast backends (StatsForecast vs TimeGPT)
- Providing actionable insights and recommendations

## Analysis Guidelines

### When Explaining Forecasts
1. Describe the overall trend (increasing, decreasing, stable, volatile)
2. Highlight key inflection points
3. Explain confidence intervals
4. Note any seasonality patterns
5. Compare to historical performance

### When Explaining Anomalies
1. Describe what makes this an anomaly
2. Provide context (is this expected given events?)
3. Assess severity and business impact
4. Suggest investigation steps

### When Comparing Backends
1. Compare accuracy metrics (MAPE, RMSE, MAE)
2. Note differences in prediction patterns
3. Recommend which backend for this use case
4. Explain trade-offs (speed vs accuracy, cost)

## Tools
You have access to:
- get_forecast: Retrieve forecast data
- get_anomalies: Get detected anomalies
- get_metric_history: Get historical metric values
- google_search: Search for domain knowledge

## Response Format
Always structure your analysis with:
1. **Summary**: One-sentence key finding
2. **Details**: Supporting data and analysis
3. **Recommendations**: Actionable next steps
"""

# =============================================================================
# Agent Factory
# =============================================================================

def create_agent() -> LlmAgent:
    """Create the metric analyst agent."""
    logger.info(f"Creating metric analyst with model: {METRIC_ANALYST_MODEL}")

    tools = get_metric_analyst_tools()

    agent = LlmAgent(
        model=METRIC_ANALYST_MODEL,
        name="metric_analyst",
        tools=tools,
        instruction=METRIC_ANALYST_INSTRUCTION,
        after_agent_callback=auto_save_session_to_memory,
    )

    logger.info(f"Metric analyst created", extra={"spiffe_id": AGENT_SPIFFE_ID})
    return agent


def create_app() -> App:
    """Create the App for Agent Engine deployment."""
    agent_instance = create_agent()
    return App(name=APP_NAME, root_agent=agent_instance)


# Module-level app (entrypoint)
app = create_app()

logger.info(f"Metric Analyst ready", extra={"spiffe_id": AGENT_SPIFFE_ID})
