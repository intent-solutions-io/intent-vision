"""
IntentVision Orchestrator Agent

Beads Task: intentvision-qd3.1

Tier 2 agent that routes requests to specialist agents.
Following bobs-brain patterns with R1-R8 compliance.

This agent:
- Receives natural language requests from IntentVision API
- Determines which specialist to delegate to
- Coordinates multi-specialist workflows
- Aggregates responses for the API
"""

import os
import logging
from google.adk.agents import LlmAgent
from google.adk.apps import App

from ..shared_tools import get_orchestrator_tools
from ..utils import auto_save_session_to_memory, get_logger

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID = os.getenv("PROJECT_ID", "intentvision")
LOCATION = os.getenv("LOCATION", "us-central1")
AGENT_ENGINE_ID = os.getenv("AGENT_ENGINE_ID", "intentvision-orchestrator")

# R7: SPIFFE ID for traceability
AGENT_SPIFFE_ID = os.getenv(
    "AGENT_SPIFFE_ID",
    f"spiffe://intent-solutions.io/agent/intentvision-orchestrator/dev/{LOCATION}/0.14.1"
)

# Model selection (flexible per mega-prompt guidance)
ORCHESTRATOR_MODEL = os.getenv("ORCHESTRATOR_MODEL", "gemini-2.0-flash-exp")

APP_NAME = "intentvision-orchestrator"

logger = get_logger(__name__)

# =============================================================================
# Agent Instruction
# =============================================================================

ORCHESTRATOR_INSTRUCTION = f"""You are the IntentVision Orchestrator Agent.

## Identity
SPIFFE ID: {AGENT_SPIFFE_ID}
Version: 0.14.1

## Role
You are the central routing and coordination agent for IntentVision, a Universal Prediction Engine. Your job is to:
1. Understand user requests about metrics, forecasts, anomalies, and alerts
2. Delegate to the appropriate specialist agent when needed
3. Provide helpful, accurate responses based on IntentVision data

## Specialists Available
You can delegate complex tasks to these specialists:
- **metric-analyst**: For explaining forecasts, analyzing anomalies, comparing backends
- **alert-tuner**: For analyzing alert rules, recommending threshold changes
- **onboarding-coach**: For helping users set up new metric connections

## Response Guidelines
- Be concise and actionable
- Always cite specific data when available
- If you need more information, ask clarifying questions
- For complex analysis, delegate to the appropriate specialist

## IntentVision Context
IntentVision provides:
- Time-series metric ingestion and normalization
- Statistical and AI-powered forecasting (StatsForecast, TimeGPT)
- Anomaly detection with multiple algorithms
- Configurable alerting with multi-channel notifications
- Multi-tenant SaaS with usage metering

## Tools
You have tools to query the IntentVision API for forecasts, anomalies, and metrics.
Use these to gather data before responding or delegating.
"""

# =============================================================================
# Agent Factory
# =============================================================================

def create_agent() -> LlmAgent:
    """
    Create the orchestrator agent.

    Follows 6767-LAZY pattern: agent created at module level,
    but actual construction deferred.
    """
    logger.info(f"Creating orchestrator agent with model: {ORCHESTRATOR_MODEL}")

    tools = get_orchestrator_tools()
    logger.info(f"Loaded {len(tools)} tools for orchestrator")

    agent = LlmAgent(
        model=ORCHESTRATOR_MODEL,
        name="intentvision_orchestrator",  # Valid Python identifier
        tools=tools,
        instruction=ORCHESTRATOR_INSTRUCTION,
        after_agent_callback=auto_save_session_to_memory,  # R5: Dual memory
    )

    logger.info(
        f"Orchestrator agent created",
        extra={"spiffe_id": AGENT_SPIFFE_ID, "model": ORCHESTRATOR_MODEL}
    )

    return agent


def create_app() -> App:
    """
    Create the App for Agent Engine deployment.

    R2: This App is deployed to Vertex AI Agent Engine,
    not self-hosted with Runner.
    """
    agent_instance = create_agent()

    app_instance = App(
        name=APP_NAME,
        root_agent=agent_instance,
    )

    logger.info(
        f"App '{APP_NAME}' created for Agent Engine",
        extra={"spiffe_id": AGENT_SPIFFE_ID}
    )

    return app_instance


# =============================================================================
# Module-level App (Entrypoint for Agent Engine)
# =============================================================================

# R2: This is the entrypoint for inline source deployment
app = create_app()

logger.info(
    f"IntentVision Orchestrator ready for Agent Engine",
    extra={"spiffe_id": AGENT_SPIFFE_ID, "app_name": APP_NAME}
)
