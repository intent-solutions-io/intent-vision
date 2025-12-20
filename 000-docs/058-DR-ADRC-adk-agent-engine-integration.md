# ADR: IntentVision ADK + Vertex AI Agent Engine Integration

**Document ID**: 058-DR-ADRC-adk-agent-engine-integration
**Phase**: B (ADK Design)
**Date**: 2025-12-16
**Status**: Accepted
**Deciders**: CTO, Engineering Team
**Beads Epic**: intentvision-e8s

---

## Context

IntentVision requires an AI agent layer to:
1. Explain forecasts and anomalies to humans
2. Assist with alert rule tuning
3. Help onboard users and map external metrics
4. Support operator workflows (noise reduction, risk assessment)

This ADR documents the architecture for integrating Google ADK (Agent Development Kit) with Vertex AI Agent Engine, following the production-grade patterns established in `bobs-brain`.

---

## Decision Summary

| Aspect | Decision |
|--------|----------|
| **Framework** | Google ADK exclusively (R1 Hard Mode) |
| **Runtime** | Vertex AI Agent Engine (R2) |
| **Architecture** | 2-tier: Orchestrator + Specialists |
| **Language** | Python 3.12+ for ADK agents |
| **Gateway** | HTTP proxy only (R3 - no Runner in gateway) |
| **Memory** | Dual wiring: Session + Memory Bank (R5) |
| **Model Flexibility** | Specialists can use different models (configurable) |

---

## 1. Agent Architecture

### 2-Tier Hierarchy

Unlike bobs-brain's 3-tier (Bob → Foreman → Specialists), IntentVision uses 2-tier because the IntentVision API itself serves as the entry point (Tier 1).

```
                    INTENTVISION AGENT ARCHITECTURE

    ┌─────────────────────────────────────────────────────────────┐
    │                   IntentVision API (Node.js)                  │
    │                   Cloud Run - HTTP Entry Point                │
    └───────────────────────────┬─────────────────────────────────┘
                                │ A2A Call
                                ▼
    ┌─────────────────────────────────────────────────────────────┐
    │              TIER 2: intentvision-orchestrator                │
    │              ──────────────────────────────────               │
    │   • Receives natural language requests from API               │
    │   • Routes to appropriate specialist via A2A                  │
    │   • Aggregates specialist responses                           │
    │   • Model: gemini-2.0-flash-exp (default)                     │
    │   • Runtime: Vertex AI Agent Engine                           │
    └───────────────────────────┬─────────────────────────────────┘
                                │ A2A Delegation
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
    │ metric-analyst│   │  alert-tuner  │   │onboarding-    │
    │               │   │               │   │coach          │
    ├───────────────┤   ├───────────────┤   ├───────────────┤
    │ Explains      │   │ Recommends    │   │ Helps map     │
    │ forecasts &   │   │ alert rule    │   │ external      │
    │ anomalies     │   │ changes       │   │ metrics       │
    ├───────────────┤   ├───────────────┤   ├───────────────┤
    │ Model:        │   │ Model:        │   │ Model:        │
    │ configurable  │   │ configurable  │   │ configurable  │
    └───────────────┘   └───────────────┘   └───────────────┘
           TIER 3: SPECIALISTS (Function Workers)
```

### Agent Definitions

#### Tier 2: intentvision-orchestrator

**Purpose**: Central routing and coordination agent

**Responsibilities**:
- Parse natural language requests from IntentVision API
- Determine which specialist to delegate to
- Coordinate multi-specialist workflows
- Aggregate responses and format for API
- Enforce compliance with IntentVision context

**Model**: `gemini-2.0-flash-exp` (default, configurable)

**Tools**:
- `delegate_to_specialist` - A2A delegation
- `query_intentvision_api` - Call IntentVision HTTP endpoints
- `search_documentation` - Search IntentVision docs

#### Tier 3: metric-analyst

**Purpose**: Explain forecasts, anomalies, and metric behavior

**Responsibilities**:
- Analyze forecast outputs and explain predictions
- Explain detected anomalies with context
- Compare forecast backends (statistical vs TimeGPT)
- Provide trend analysis and insights

**Model**: Configurable (default: `gemini-2.0-flash-exp`)

**Tools**:
- `get_forecast` - Retrieve forecast data from API
- `get_anomalies` - Retrieve detected anomalies
- `get_metric_history` - Get historical metric data
- `compare_backends` - Compare forecast backend results

#### Tier 3: alert-tuner

**Purpose**: Recommend and apply alert rule changes

**Responsibilities**:
- Analyze alert rule effectiveness
- Recommend threshold changes based on historical data
- Identify noisy alerts and suggest suppression
- Preview alert rule changes before applying

**Model**: Configurable (default: `gemini-2.0-flash-exp`)

**Tools**:
- `get_alert_rules` - List alert rules for org
- `analyze_alert_history` - Analyze alert firing patterns
- `recommend_threshold` - Suggest threshold changes
- `preview_rule_change` - Preview impact of changes

#### Tier 3: onboarding-coach

**Purpose**: Help users map external metrics to IntentVision

**Responsibilities**:
- Guide users through metric onboarding
- Map external source schemas to canonical metrics
- Suggest dimension mappings and transformations
- Validate ingestion configurations

**Model**: Configurable (default: `gemini-2.0-flash-exp`)

**Tools**:
- `list_connectors` - List available data connectors
- `analyze_source_schema` - Analyze external data schema
- `suggest_mapping` - Suggest metric mappings
- `validate_config` - Validate ingestion configuration

---

## 2. A2A Protocol

### AgentCard Specification

Each agent exposes an AgentCard for A2A discovery:

```json
{
  "protocol_version": "0.3.0",
  "name": "intentvision-orchestrator",
  "version": "0.14.1",
  "url": "https://agents.intentvision.intent-solutions.io/orchestrator",
  "description": "IntentVision Orchestrator Agent\n\nIdentity: spiffe://intent-solutions.io/agent/intentvision-orchestrator/{env}/{region}/{version}",
  "capabilities": ["routing", "coordination", "explanation"],
  "preferred_transport": "JSONRPC",
  "skills": [
    {
      "name": "Explain Forecast",
      "description": "Explain a forecast prediction for a metric",
      "input_schema": {
        "type": "object",
        "required": ["org_id", "metric_key"],
        "properties": {
          "org_id": {"type": "string"},
          "metric_key": {"type": "string"},
          "time_range": {"type": "string"}
        }
      },
      "output_schema": {
        "type": "object",
        "required": ["explanation", "confidence"],
        "properties": {
          "explanation": {"type": "string"},
          "confidence": {"type": "number"},
          "supporting_data": {"type": "object"}
        }
      }
    }
  ],
  "spiffe_id": "spiffe://intent-solutions.io/agent/intentvision-orchestrator/dev/us-central1/0.14.1"
}
```

### A2A Data Contracts

```python
# adk/agents/shared_contracts.py

@dataclass
class ExplainForecastRequest:
    """Request to explain a forecast"""
    org_id: str
    metric_key: str
    time_range: Optional[str] = "7d"
    include_anomalies: bool = True

@dataclass
class ExplainForecastResponse:
    """Forecast explanation response"""
    explanation: str
    confidence: float
    forecast_values: List[Dict]
    anomalies: List[Dict]
    recommendations: List[str]

@dataclass
class TuneAlertRequest:
    """Request to tune an alert rule"""
    org_id: str
    alert_rule_id: str
    analysis_period: str = "30d"

@dataclass
class TuneAlertResponse:
    """Alert tuning recommendation"""
    current_threshold: float
    recommended_threshold: float
    rationale: str
    expected_noise_reduction: float
    preview_alerts: List[Dict]
```

---

## 3. Directory Structure

```
intentvision/
├── adk/                                # NEW: Python ADK code
│   ├── agents/
│   │   ├── orchestrator/               # Tier 2
│   │   │   ├── __init__.py
│   │   │   ├── agent.py                # LlmAgent definition
│   │   │   ├── .well-known/
│   │   │   │   └── agent-card.json     # A2A discovery
│   │   │   └── tools/
│   │   │       └── delegation_tools.py
│   │   │
│   │   ├── metric_analyst/             # Tier 3
│   │   │   ├── __init__.py
│   │   │   ├── agent.py
│   │   │   ├── .well-known/
│   │   │   │   └── agent-card.json
│   │   │   └── tools/
│   │   │       └── analysis_tools.py
│   │   │
│   │   ├── alert_tuner/                # Tier 3
│   │   │   ├── __init__.py
│   │   │   ├── agent.py
│   │   │   └── tools/
│   │   │       └── tuning_tools.py
│   │   │
│   │   ├── onboarding_coach/           # Tier 3
│   │   │   ├── __init__.py
│   │   │   ├── agent.py
│   │   │   └── tools/
│   │   │       └── onboarding_tools.py
│   │   │
│   │   ├── shared_contracts.py         # A2A data contracts
│   │   ├── shared_tools/               # Centralized tool profiles
│   │   │   ├── __init__.py
│   │   │   ├── intentvision_api.py     # IntentVision API tools
│   │   │   └── common.py               # Google Search, etc.
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── memory.py               # Memory Bank helpers
│   │       └── logging.py              # AgentFS integration
│   │
│   ├── service/                        # HTTP Gateways (R3)
│   │   └── a2a_gateway/
│   │       ├── __init__.py
│   │       └── main.py                 # FastAPI proxy
│   │
│   ├── scripts/
│   │   ├── ci/
│   │   │   └── check_nodrift.sh        # R1-R8 enforcement
│   │   ├── deploy_inline_source.py     # Agent Engine deployment
│   │   └── check_arv_minimum.py        # ARV gate
│   │
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── test_orchestrator.py
│   │   │   └── test_agentcard.py
│   │   └── integration/
│   │       └── test_a2a_flow.py
│   │
│   ├── requirements.txt                # Python dependencies
│   ├── pyproject.toml                  # Python project config
│   └── Makefile                        # Development commands
│
├── packages/                           # Existing Node.js code
├── .github/workflows/
│   ├── ci.yml                          # Existing CI
│   └── agent-engine-deploy.yml         # NEW: ADK deployment
└── infra/terraform/
    └── agent_engine.tf                 # NEW: Agent Engine IaC
```

---

## 4. Tool Architecture

### IntentVision API Tools

Tools that call the IntentVision Node.js API:

```python
# adk/agents/shared_tools/intentvision_api.py

from google.adk.agents import FunctionTool
import httpx

INTENTVISION_API_URL = os.getenv("INTENTVISION_API_URL", "https://intentvision.intent-solutions.io")

def get_forecast(org_id: str, metric_key: str, horizon: int = 7) -> dict:
    """Get forecast for a metric from IntentVision API"""
    response = httpx.get(
        f"{INTENTVISION_API_URL}/v1/forecast/{org_id}/{metric_key}",
        params={"horizon": horizon},
        headers={"X-API-Key": os.getenv("INTENTVISION_API_KEY")}
    )
    return response.json()

def get_tools():
    return [
        FunctionTool(func=get_forecast, name="get_forecast", description="..."),
        FunctionTool(func=get_anomalies, name="get_anomalies", description="..."),
        FunctionTool(func=get_alert_rules, name="get_alert_rules", description="..."),
        FunctionTool(func=run_pipeline, name="run_pipeline", description="..."),
    ]
```

### Tool Profiles Per Agent

Following bobs-brain's principle of least privilege:

| Agent | Tools |
|-------|-------|
| orchestrator | delegate_to_specialist, query_intentvision_api, search_docs |
| metric-analyst | get_forecast, get_anomalies, get_metric_history, compare_backends |
| alert-tuner | get_alert_rules, analyze_alert_history, recommend_threshold, preview_change |
| onboarding-coach | list_connectors, analyze_schema, suggest_mapping, validate_config |

---

## 5. Model Flexibility

### Configuration Pattern

Each specialist can use a different model:

```python
# Environment variables for model selection
ORCHESTRATOR_MODEL = os.getenv("ORCHESTRATOR_MODEL", "gemini-2.0-flash-exp")
METRIC_ANALYST_MODEL = os.getenv("METRIC_ANALYST_MODEL", "gemini-2.0-flash-exp")
ALERT_TUNER_MODEL = os.getenv("ALERT_TUNER_MODEL", "gemini-2.0-flash-exp")
ONBOARDING_COACH_MODEL = os.getenv("ONBOARDING_COACH_MODEL", "gemini-2.0-flash-exp")
```

### Supported Models

| Model | Use Case |
|-------|----------|
| `gemini-2.0-flash-exp` | Default, fast, cost-effective |
| `gemini-1.5-pro` | Complex reasoning, longer context |
| `gemini-1.5-flash` | Balance of speed and capability |

---

## 6. Memory & State

### R5: Dual Memory Wiring

```python
from google.adk.sessions import VertexAiSessionService
from google.adk.memory import VertexAiMemoryBankService

# Session (short-term conversation cache)
session_service = VertexAiSessionService(
    project=PROJECT_ID,
    location=LOCATION,
    agent_engine_id=AGENT_ENGINE_ID
)

# Memory Bank (long-term persistent)
memory_service = VertexAiMemoryBankService(
    project=PROJECT_ID,
    location=LOCATION,
    agent_engine_id=AGENT_ENGINE_ID
)

# Auto-save callback
def auto_save_session_to_memory(ctx):
    """Persist session to Memory Bank after each turn"""
    try:
        invocation_ctx = ctx._invocation_context
        if invocation_ctx.memory_service and invocation_ctx.session:
            invocation_ctx.memory_service.add_session_to_memory(invocation_ctx.session)
    except Exception as e:
        logger.error(f"Memory save failed: {e}")
```

---

## 7. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/agent-engine-deploy.yml
name: Agent Engine Deployment

on:
  push:
    branches: [main]
    paths:
      - 'adk/**'
  workflow_dispatch:
    inputs:
      agent_name:
        type: choice
        options: [orchestrator, metric-analyst, alert-tuner, onboarding-coach]
      environment:
        type: choice
        options: [dev, staging, prod]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Run drift detection (R1-R8)
        run: bash adk/scripts/ci/check_nodrift.sh

      - name: Run tests
        run: |
          pip install -r adk/requirements.txt
          pytest adk/tests/

      - name: Run ARV minimum gate
        run: python adk/scripts/check_arv_minimum.py

      - name: Authenticate via WIF (R4)
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_SA_EMAIL }}

      - name: Deploy to Agent Engine
        run: |
          python adk/scripts/deploy_inline_source.py \
            --agent ${{ inputs.agent_name || 'orchestrator' }} \
            --env ${{ inputs.environment || 'dev' }}
```

---

## 8. ARV Gates

### Minimum Requirements

| Check | Description |
|-------|-------------|
| Agent imports | Module imports without error |
| App instance | `app` is valid `App` instance |
| Root agent | `root_agent` is `LlmAgent` |
| Tools configured | At least one tool |
| AgentCard exists | `.well-known/agent-card.json` |
| SPIFFE ID | AgentCard contains spiffe_id |
| Memory wiring | after_agent_callback configured |

### Drift Detection (R1-R8)

```bash
# adk/scripts/ci/check_nodrift.sh

# R1: No alternative frameworks
grep -r "from langchain|import crewai|import autogen" adk/ && exit 1

# R3: No Runner in service/
grep -r "from google.adk.runner" adk/service/ && exit 1

# R4: No local credentials
find adk/ -name "*-key.json" && exit 1

echo "✅ No drift detected"
```

---

## 9. Beads / Task References

| Task ID | Description | Status |
|---------|-------------|--------|
| `intentvision-e8s` | Phase B: ADK/Agent Engine Design (Epic) | In Progress |
| `intentvision-e8s.1` | B.1 Define orchestrator + specialists | Completed |
| `intentvision-e8s.2` | B.2 Define tools/APIs | Completed |
| `intentvision-e8s.3` | B.3 Write ADR | Completed |

---

## Consequences

### Positive
- Production-grade ADK patterns from bobs-brain
- Model flexibility per specialist
- Clear separation of concerns (orchestrator vs specialists)
- Dual memory for context persistence
- ARV gates ensure deployment quality

### Negative
- Additional Python codebase to maintain
- Agent Engine costs
- Learning curve for ADK patterns

### Risks
- Agent Engine availability
- Model costs at scale (mitigated by model selection)
- A2A protocol complexity (mitigated by following bobs-brain exactly)

---

## Related Documents

- 057-AA-AACR-phase-a-baseline-status-gaps.md (Previous phase)
- 055-DR-ADRC-deployment-foundation-decisions.md (GCP infrastructure)
- bobs-brain `6767-DR-STND-adk-agent-engine-spec-and-hardmode-rules.md` (Reference)

---

*Architecture Decision Record - Phase B ADK Integration*
*intent solutions io - confidential IP*
