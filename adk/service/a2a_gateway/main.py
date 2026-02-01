"""
IntentVision A2A Gateway Service

Beads Task: intentvision-qd3.5

FastAPI service that bridges IntentVision TypeScript API with
Python ADK agents deployed on Vertex AI Agent Engine.

Following bobs-brain patterns:
- R3: Gateway boundary (this service IS the gateway)
- A2A protocol compliance for agent communication
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from google.cloud import aiplatform
from pydantic import BaseModel, Field

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID = os.getenv("PROJECT_ID", "intentvision")
LOCATION = os.getenv("LOCATION", "us-central1")
ENV = os.getenv("ENV", "dev")

# Agent Engine IDs (deployed agents)
AGENT_ENGINE_IDS = {
    "orchestrator": f"intentvision-orchestrator-{ENV}",
    "metric-analyst": f"intentvision-metric-analyst-{ENV}",
    "alert-tuner": f"intentvision-alert-tuner-{ENV}",
    "onboarding-coach": f"intentvision-onboarding-coach-{ENV}",
}

# SPIFFE identity for this gateway
GATEWAY_SPIFFE_ID = f"spiffe://intent-solutions.io/gateway/a2a/{ENV}/{LOCATION}"


# =============================================================================
# Pydantic Models (A2A Protocol)
# =============================================================================

class AgentSkill(BaseModel):
    """A2A skill definition."""
    name: str
    description: str
    input_schema: Dict[str, Any] = Field(default_factory=dict)
    output_schema: Dict[str, Any] = Field(default_factory=dict)


class AgentCard(BaseModel):
    """A2A Agent Card schema."""
    protocol_version: str = "0.3.0"
    name: str
    version: str
    url: str
    description: str
    capabilities: List[str] = Field(default_factory=list)
    skills: List[AgentSkill] = Field(default_factory=list)
    spiffe_id: Optional[str] = None


class TaskRequest(BaseModel):
    """A2A Task submission request."""
    skill: str
    input: Dict[str, Any]
    session_id: Optional[str] = None
    trace_id: Optional[str] = None


class TaskStatus(BaseModel):
    """A2A Task status response."""
    task_id: str
    status: str  # pending, running, completed, failed
    created_at: str
    updated_at: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class GatewayHealth(BaseModel):
    """Gateway health check response."""
    status: str
    gateway_id: str
    spiffe_id: str
    timestamp: str
    agents: Dict[str, str]


# =============================================================================
# Agent Engine Client
# =============================================================================

class AgentEngineClient:
    """Client for communicating with Vertex AI Agent Engine."""

    def __init__(self, project_id: str, location: str):
        self.project_id = project_id
        self.location = location
        aiplatform.init(project=project_id, location=location)

    async def send_message(
        self,
        agent_engine_id: str,
        message: str,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a message to an agent and get response."""
        # In production, this would use the Agent Engine API
        # For now, return a stub response

        # Agent Engine endpoint
        endpoint = f"projects/{self.project_id}/locations/{self.location}/agents/{agent_engine_id}"

        # TODO: Replace with actual Agent Engine SDK call when available
        # For now, simulate the response structure
        return {
            "session_id": session_id or f"session-{agent_engine_id}",
            "response": f"[Stub] Agent {agent_engine_id} received: {message}",
            "agent_engine_id": agent_engine_id,
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def get_agent_status(self, agent_engine_id: str) -> str:
        """Check if an agent is available."""
        # In production, check actual Agent Engine status
        return "available"


# =============================================================================
# Application
# =============================================================================

agent_client: Optional[AgentEngineClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup."""
    global agent_client
    agent_client = AgentEngineClient(PROJECT_ID, LOCATION)
    yield
    # Cleanup on shutdown
    agent_client = None


app = FastAPI(
    title="IntentVision A2A Gateway",
    description="Gateway service for A2A protocol communication with ADK agents",
    version="0.14.1",
    lifespan=lifespan,
)


# =============================================================================
# Endpoints
# =============================================================================

@app.get("/health", response_model=GatewayHealth)
async def health_check():
    """Gateway health check endpoint."""
    agents_status = {}
    for name, agent_id in AGENT_ENGINE_IDS.items():
        agents_status[name] = await agent_client.get_agent_status(agent_id) if agent_client else "unknown"

    return GatewayHealth(
        status="healthy",
        gateway_id=f"a2a-gateway-{ENV}",
        spiffe_id=GATEWAY_SPIFFE_ID,
        timestamp=datetime.utcnow().isoformat(),
        agents=agents_status,
    )


@app.get("/agents", response_model=List[str])
async def list_agents():
    """List available agents."""
    return list(AGENT_ENGINE_IDS.keys())


@app.get("/agents/{agent_name}/.well-known/agent-card.json", response_model=AgentCard)
async def get_agent_card(agent_name: str):
    """Get A2A Agent Card for an agent (R3 compliance)."""
    if agent_name not in AGENT_ENGINE_IDS:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_name}")

    # In production, fetch from the deployed agent
    # For now, return the card based on agent name
    cards = {
        "orchestrator": AgentCard(
            name="intentvision-orchestrator",
            version="0.14.1",
            url=f"https://agents.intentvision.intent-solutions.io/orchestrator",
            description="IntentVision Orchestrator - Routes requests to specialists",
            capabilities=["routing", "coordination", "forecast_explanation"],
            skills=[
                AgentSkill(
                    name="Explain Forecast",
                    description="Explain forecast predictions for a metric",
                    input_schema={"type": "object", "required": ["org_id", "metric_key"]},
                ),
                AgentSkill(
                    name="Analyze Alerts",
                    description="Analyze alert rules and recommend changes",
                    input_schema={"type": "object", "required": ["org_id"]},
                ),
            ],
            spiffe_id=f"spiffe://intent-solutions.io/agent/intentvision-orchestrator/{ENV}/{LOCATION}/0.14.1",
        ),
        "metric-analyst": AgentCard(
            name="metric-analyst",
            version="0.14.1",
            url=f"https://agents.intentvision.intent-solutions.io/metric-analyst",
            description="IntentVision Metric Analyst - Forecast and anomaly analysis",
            capabilities=["forecast_explanation", "anomaly_analysis", "backend_comparison"],
            skills=[
                AgentSkill(
                    name="Explain Forecast",
                    description="Provide detailed explanation of forecast predictions",
                    input_schema={"type": "object", "required": ["org_id", "metric_key"]},
                ),
            ],
            spiffe_id=f"spiffe://intent-solutions.io/agent/metric-analyst/{ENV}/{LOCATION}/0.14.1",
        ),
        "alert-tuner": AgentCard(
            name="alert-tuner",
            version="0.14.1",
            url=f"https://agents.intentvision.intent-solutions.io/alert-tuner",
            description="IntentVision Alert Tuner - Alert optimization",
            capabilities=["alert_analysis", "threshold_optimization", "noise_reduction"],
            skills=[
                AgentSkill(
                    name="Analyze Alerts",
                    description="Analyze alert rules and firing patterns",
                    input_schema={"type": "object", "required": ["org_id"]},
                ),
            ],
            spiffe_id=f"spiffe://intent-solutions.io/agent/alert-tuner/{ENV}/{LOCATION}/0.14.1",
        ),
        "onboarding-coach": AgentCard(
            name="onboarding-coach",
            version="0.14.1",
            url=f"https://agents.intentvision.intent-solutions.io/onboarding-coach",
            description="IntentVision Onboarding Coach - Setup assistance",
            capabilities=["connection_guidance", "metric_configuration"],
            skills=[
                AgentSkill(
                    name="Guide Connection",
                    description="Guide user through connecting a data source",
                    input_schema={"type": "object", "required": ["org_id", "source_type"]},
                ),
            ],
            spiffe_id=f"spiffe://intent-solutions.io/agent/onboarding-coach/{ENV}/{LOCATION}/0.14.1",
        ),
    }

    return cards.get(agent_name, AgentCard(
        name=agent_name,
        version="0.14.1",
        url=f"https://agents.intentvision.intent-solutions.io/{agent_name}",
        description=f"IntentVision {agent_name}",
    ))


@app.post("/agents/{agent_name}/tasks", response_model=TaskStatus)
async def submit_task(agent_name: str, request: TaskRequest):
    """Submit a task to an agent (A2A protocol)."""
    if agent_name not in AGENT_ENGINE_IDS:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_name}")

    agent_engine_id = AGENT_ENGINE_IDS[agent_name]

    # Build message from skill and input
    message = f"Execute skill '{request.skill}' with input: {request.input}"

    try:
        response = await agent_client.send_message(
            agent_engine_id=agent_engine_id,
            message=message,
            session_id=request.session_id,
        )

        task_id = f"task-{agent_name}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        return TaskStatus(
            task_id=task_id,
            status="completed",
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
            result=response,
        )
    except Exception as e:
        return TaskStatus(
            task_id=f"task-{agent_name}-error",
            status="failed",
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
            error=str(e),
        )


@app.post("/agents/orchestrator/chat")
async def chat_with_orchestrator(request: Request):
    """
    Simplified chat endpoint for the orchestrator.
    This is what the IntentVision API will call.
    """
    body = await request.json()
    message = body.get("message", "")
    org_id = body.get("org_id", "")
    session_id = body.get("session_id")

    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if not org_id:
        raise HTTPException(status_code=400, detail="org_id is required")

    agent_engine_id = AGENT_ENGINE_IDS["orchestrator"]

    # Prepend org context to message
    full_message = f"[Organization: {org_id}] {message}"

    response = await agent_client.send_message(
        agent_engine_id=agent_engine_id,
        message=full_message,
        session_id=session_id,
    )

    return JSONResponse(content={
        "response": response.get("response", ""),
        "session_id": response.get("session_id"),
        "trace_id": response.get("trace_id"),
    })


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
