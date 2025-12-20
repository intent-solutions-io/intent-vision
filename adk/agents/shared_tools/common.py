"""
Common Tools - Shared across multiple agents

Beads Task: intentvision-qd3.1
"""

import os
from google.adk.agents import FunctionTool


def google_search(query: str, num_results: int = 5) -> str:
    """
    Search Google for information.

    Args:
        query: Search query string
        num_results: Maximum number of results to return

    Returns:
        Formatted search results as string
    """
    # This is a placeholder - in production, use Google Search API
    # or the built-in ADK google_search tool
    return f"[Search results for '{query}' - {num_results} results]"


def get_google_search_tool():
    """Get Google Search as a FunctionTool"""
    return FunctionTool(
        func=google_search,
        name="google_search",
        description="Search Google for information about metrics, forecasting, anomaly detection, and related topics"
    )
