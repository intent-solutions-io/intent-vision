"""
Test A2A Gateway Service

Beads Task: intentvision-qd3.6

Tests for the FastAPI A2A gateway service.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create test client for A2A gateway."""
    from service.a2a_gateway.main import app
    return TestClient(app)


class TestHealthEndpoint:
    """Test /health endpoint."""

    def test_health_returns_200(self, client):
        """Health check should return 200."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_has_required_fields(self, client):
        """Health response should have required fields."""
        response = client.get("/health")
        data = response.json()

        assert "status" in data
        assert "gateway_id" in data
        assert "spiffe_id" in data
        assert "timestamp" in data
        assert "agents" in data

    def test_health_status_is_healthy(self, client):
        """Health status should be 'healthy'."""
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "healthy"


class TestAgentsEndpoint:
    """Test /agents endpoint."""

    def test_list_agents(self, client):
        """Should list all available agents."""
        response = client.get("/agents")
        assert response.status_code == 200

        agents = response.json()
        assert isinstance(agents, list)
        assert "orchestrator" in agents
        assert "metric-analyst" in agents
        assert "alert-tuner" in agents
        assert "onboarding-coach" in agents


class TestAgentCardEndpoint:
    """Test agent card discovery endpoint."""

    def test_get_orchestrator_card(self, client):
        """Should return orchestrator agent card."""
        response = client.get("/agents/orchestrator/.well-known/agent-card.json")
        assert response.status_code == 200

        card = response.json()
        assert card["name"] == "intentvision-orchestrator"
        assert "skills" in card
        assert "spiffe_id" in card

    def test_get_metric_analyst_card(self, client):
        """Should return metric-analyst agent card."""
        response = client.get("/agents/metric-analyst/.well-known/agent-card.json")
        assert response.status_code == 200

        card = response.json()
        assert "metric" in card["name"].lower()

    def test_unknown_agent_returns_404(self, client):
        """Unknown agent should return 404."""
        response = client.get("/agents/unknown-agent/.well-known/agent-card.json")
        assert response.status_code == 404


class TestTaskSubmission:
    """Test task submission endpoint."""

    def test_submit_task_to_orchestrator(self, client):
        """Should submit task to orchestrator."""
        response = client.post(
            "/agents/orchestrator/tasks",
            json={
                "skill": "Explain Forecast",
                "input": {
                    "org_id": "test-org",
                    "metric_key": "revenue.daily",
                },
            },
        )
        assert response.status_code == 200

        result = response.json()
        assert "task_id" in result
        assert "status" in result
        assert result["status"] in ("completed", "pending", "running")

    def test_submit_task_to_unknown_agent(self, client):
        """Task to unknown agent should return 404."""
        response = client.post(
            "/agents/unknown-agent/tasks",
            json={
                "skill": "test",
                "input": {},
            },
        )
        assert response.status_code == 404


class TestChatEndpoint:
    """Test orchestrator chat endpoint."""

    def test_chat_with_orchestrator(self, client):
        """Should chat with orchestrator."""
        response = client.post(
            "/agents/orchestrator/chat",
            json={
                "message": "Explain the forecast for revenue",
                "org_id": "test-org",
            },
        )
        assert response.status_code == 200

        result = response.json()
        assert "response" in result
        assert "session_id" in result

    def test_chat_requires_message(self, client):
        """Chat should require message."""
        response = client.post(
            "/agents/orchestrator/chat",
            json={
                "org_id": "test-org",
            },
        )
        assert response.status_code == 400

    def test_chat_requires_org_id(self, client):
        """Chat should require org_id."""
        response = client.post(
            "/agents/orchestrator/chat",
            json={
                "message": "Hello",
            },
        )
        assert response.status_code == 400
