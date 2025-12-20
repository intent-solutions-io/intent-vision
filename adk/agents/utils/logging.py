"""
Logging Utilities - AgentFS Integration

Beads Task: intentvision-qd3.1

Provides structured logging with SPIFFE ID propagation (R7)
and optional AgentFS integration.
"""

import os
import logging
from typing import Dict, Any, Optional

# Configuration
AGENT_SPIFFE_ID = os.getenv("AGENT_SPIFFE_ID", "spiffe://intent-solutions.io/agent/unknown")
AGENTFS_ENABLED = os.getenv("IV_AGENTFS_ENABLED", "false").lower() == "true"
AGENTFS_PROJECT = os.getenv("IV_AGENTFS_PROJECT", "intentvision")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with SPIFFE ID propagation.

    R7: All logs must include SPIFFE ID for traceability.
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            f"%(asctime)s %(levelname)s [spiffe={AGENT_SPIFFE_ID}] %(name)s: %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    return logger


def log_agent_event(
    logger: logging.Logger,
    event_type: str,
    data: Dict[str, Any],
    task_id: Optional[str] = None
):
    """
    Log an agent event with structured data.

    Optionally persists to AgentFS if enabled.
    """
    event = {
        "event_type": event_type,
        "spiffe_id": AGENT_SPIFFE_ID,
        "task_id": task_id,
        **data
    }

    logger.info(f"Agent event: {event_type}", extra=event)

    # AgentFS integration (if enabled)
    if AGENTFS_ENABLED:
        try:
            _persist_to_agentfs(event)
        except Exception as e:
            # Non-fatal - just log the error
            logger.warning(f"Failed to persist to AgentFS: {e}")


def _persist_to_agentfs(event: Dict[str, Any]):
    """
    Persist event to AgentFS.

    This is a placeholder - actual implementation depends on
    AgentFS SDK availability in Python.
    """
    # TODO: Implement AgentFS Python SDK integration
    # For now, this is a stub
    pass
