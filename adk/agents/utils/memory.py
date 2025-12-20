"""
Memory Utilities - R5 Dual Memory Wiring

Beads Task: intentvision-qd3.1

Provides the auto_save_session_to_memory callback for R5 compliance.
"""

import os
import logging

logger = logging.getLogger(__name__)

AGENT_SPIFFE_ID = os.getenv("AGENT_SPIFFE_ID", "spiffe://intent-solutions.io/agent/unknown")


def auto_save_session_to_memory(ctx):
    """
    R5: Auto-save session to Memory Bank after each agent turn.

    This callback is attached to each agent via after_agent_callback.
    It persists the conversation session to long-term memory.

    Failures are logged but do not block agent execution.
    """
    try:
        if hasattr(ctx, "_invocation_context"):
            invocation_ctx = ctx._invocation_context
            memory_svc = getattr(invocation_ctx, "memory_service", None)
            session = getattr(invocation_ctx, "session", None)

            if memory_svc and session:
                memory_svc.add_session_to_memory(session)
                logger.info(
                    f"Saved session {session.id} to Memory Bank",
                    extra={"spiffe_id": AGENT_SPIFFE_ID}
                )
    except Exception as e:
        # R5: Failures must not block agent execution
        logger.error(
            f"Failed to save session to Memory Bank: {e}",
            extra={"spiffe_id": AGENT_SPIFFE_ID}
        )
