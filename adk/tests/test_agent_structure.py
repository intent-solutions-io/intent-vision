"""
Test Agent Structure and Compliance

Beads Task: intentvision-qd3.6

Tests that verify ADK agents follow required patterns:
- R2: App-based deployment
- R5: Dual memory wiring
- R7: SPIFFE ID propagation
"""

import json
from pathlib import Path
import pytest


class TestAgentStructure:
    """Test agent module structure."""

    @pytest.fixture
    def agents_dir(self, adk_root: Path) -> Path:
        return adk_root / "agents"

    @pytest.fixture
    def agent_names(self) -> list:
        return ["orchestrator", "metric_analyst", "alert_tuner", "onboarding_coach"]

    def test_agents_directory_exists(self, agents_dir: Path):
        """Verify agents directory exists."""
        assert agents_dir.exists(), "agents/ directory should exist"
        assert agents_dir.is_dir(), "agents/ should be a directory"

    def test_each_agent_has_init(self, agents_dir: Path, agent_names: list):
        """Each agent should have __init__.py."""
        for agent_name in agent_names:
            agent_dir = agents_dir / agent_name
            init_file = agent_dir / "__init__.py"
            assert init_file.exists(), f"{agent_name} should have __init__.py"

    def test_each_agent_has_agent_py(self, agents_dir: Path, agent_names: list):
        """Each agent should have agent.py."""
        for agent_name in agent_names:
            agent_dir = agents_dir / agent_name
            agent_file = agent_dir / "agent.py"
            assert agent_file.exists(), f"{agent_name} should have agent.py"

    def test_each_agent_has_agent_card(self, agents_dir: Path, agent_names: list):
        """Each agent should have .well-known/agent-card.json."""
        for agent_name in agent_names:
            agent_dir = agents_dir / agent_name
            card_file = agent_dir / ".well-known" / "agent-card.json"
            assert card_file.exists(), f"{agent_name} should have agent-card.json"


class TestR2Compliance:
    """Test R2: Agent Engine deployment compliance."""

    @pytest.fixture
    def agents_dir(self, adk_root: Path) -> Path:
        return adk_root / "agents"

    @pytest.fixture
    def agent_names(self) -> list:
        return ["orchestrator", "metric_analyst", "alert_tuner", "onboarding_coach"]

    def test_agents_use_app_not_runner(self, agents_dir: Path, agent_names: list):
        """Agents should use App class, not Runner."""
        for agent_name in agent_names:
            agent_file = agents_dir / agent_name / "agent.py"
            content = agent_file.read_text()

            # Should have App import
            assert "from google.adk.apps import App" in content, \
                f"{agent_name} should import App"

            # Should have create_app function
            assert "def create_app" in content, \
                f"{agent_name} should have create_app()"

            # Should NOT have Runner import in production code
            # (Runner is allowed in tests)
            assert "from google.adk.runners import Runner" not in content, \
                f"{agent_name} should not use Runner (R2 violation)"


class TestR5Compliance:
    """Test R5: Dual memory wiring compliance."""

    @pytest.fixture
    def agents_dir(self, adk_root: Path) -> Path:
        return adk_root / "agents"

    @pytest.fixture
    def agent_names(self) -> list:
        return ["orchestrator", "metric_analyst", "alert_tuner", "onboarding_coach"]

    def test_agents_have_memory_callback(self, agents_dir: Path, agent_names: list):
        """Agents should have after_agent_callback for memory wiring."""
        for agent_name in agent_names:
            agent_file = agents_dir / agent_name / "agent.py"
            content = agent_file.read_text()

            assert "after_agent_callback=auto_save_session_to_memory" in content, \
                f"{agent_name} should have dual memory wiring (R5)"


class TestR7Compliance:
    """Test R7: SPIFFE ID propagation compliance."""

    @pytest.fixture
    def agents_dir(self, adk_root: Path) -> Path:
        return adk_root / "agents"

    @pytest.fixture
    def agent_names(self) -> list:
        return ["orchestrator", "metric_analyst", "alert_tuner", "onboarding_coach"]

    def test_agents_have_spiffe_id(self, agents_dir: Path, agent_names: list):
        """Agents should have SPIFFE ID configured."""
        for agent_name in agent_names:
            agent_file = agents_dir / agent_name / "agent.py"
            content = agent_file.read_text()

            assert "AGENT_SPIFFE_ID" in content, \
                f"{agent_name} should have SPIFFE ID (R7)"

            assert "spiffe://" in content, \
                f"{agent_name} should have valid SPIFFE URI"

    def test_agent_cards_have_spiffe_id(self, agents_dir: Path, agent_names: list):
        """Agent cards should have spiffe_id field."""
        for agent_name in agent_names:
            card_file = agents_dir / agent_name / ".well-known" / "agent-card.json"
            card = json.loads(card_file.read_text())

            assert "spiffe_id" in card, \
                f"{agent_name} card should have spiffe_id"

            assert card["spiffe_id"].startswith("spiffe://"), \
                f"{agent_name} card should have valid SPIFFE URI"


class TestAgentCardSchema:
    """Test A2A Agent Card schema compliance."""

    @pytest.fixture
    def agents_dir(self, adk_root: Path) -> Path:
        return adk_root / "agents"

    @pytest.fixture
    def agent_names(self) -> list:
        return ["orchestrator", "metric_analyst", "alert_tuner", "onboarding_coach"]

    def test_required_fields(self, agents_dir: Path, agent_names: list):
        """Agent cards should have required fields."""
        required = ["name", "version", "description", "skills"]

        for agent_name in agent_names:
            card_file = agents_dir / agent_name / ".well-known" / "agent-card.json"
            card = json.loads(card_file.read_text())

            for field in required:
                assert field in card, \
                    f"{agent_name} card missing required field: {field}"

    def test_skills_have_schema(self, agents_dir: Path, agent_names: list):
        """Each skill should have input_schema."""
        for agent_name in agent_names:
            card_file = agents_dir / agent_name / ".well-known" / "agent-card.json"
            card = json.loads(card_file.read_text())

            for skill in card.get("skills", []):
                assert "name" in skill, \
                    f"{agent_name} skill missing 'name'"
                assert "description" in skill, \
                    f"{agent_name} skill missing 'description'"
                assert "input_schema" in skill, \
                    f"{agent_name} skill '{skill.get('name')}' missing input_schema"

    def test_protocol_version(self, agents_dir: Path, agent_names: list):
        """Agent cards should have protocol_version 0.3.0."""
        for agent_name in agent_names:
            card_file = agents_dir / agent_name / ".well-known" / "agent-card.json"
            card = json.loads(card_file.read_text())

            assert card.get("protocol_version") == "0.3.0", \
                f"{agent_name} should use A2A protocol version 0.3.0"
