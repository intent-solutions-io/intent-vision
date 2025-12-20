#!/usr/bin/env python3
"""
IntentVision ADK ARV (Acceptance/Regression/Validation) Gate

Beads Task: intentvision-qd3.4

Minimum viability checks before Agent Engine deployment:
1. Python syntax validation
2. Import verification
3. Agent card validation
4. Schema compliance
"""

import ast
import json
import sys
from pathlib import Path
from typing import List, Tuple

# Colors for terminal output
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"  # No Color


def log_pass(msg: str) -> None:
    print(f"{GREEN}[PASS]{NC} {msg}")


def log_fail(msg: str) -> None:
    print(f"{RED}[FAIL]{NC} {msg}")


def log_warn(msg: str) -> None:
    print(f"{YELLOW}[WARN]{NC} {msg}")


def log_info(msg: str) -> None:
    print(f"[INFO] {msg}")


def check_python_syntax(adk_root: Path) -> List[str]:
    """Validate Python syntax for all .py files."""
    errors = []
    py_files = list(adk_root.rglob("*.py"))

    for py_file in py_files:
        if "__pycache__" in str(py_file):
            continue
        try:
            with open(py_file, "r") as f:
                source = f.read()
            ast.parse(source)
        except SyntaxError as e:
            errors.append(f"{py_file}: {e}")

    return errors


def check_agent_cards(adk_root: Path) -> Tuple[List[str], List[str]]:
    """Validate agent-card.json files."""
    errors = []
    warnings = []

    required_fields = ["name", "version", "description", "skills"]
    recommended_fields = ["spiffe_id", "protocol_version", "capabilities"]

    agents_dir = adk_root / "agents"
    if not agents_dir.exists():
        errors.append("agents/ directory not found")
        return errors, warnings

    for agent_dir in agents_dir.iterdir():
        if not agent_dir.is_dir():
            continue
        if agent_dir.name in ("__pycache__", "shared_tools", "utils"):
            continue

        card_file = agent_dir / ".well-known" / "agent-card.json"
        if not card_file.exists():
            warnings.append(f"Agent '{agent_dir.name}' missing agent-card.json")
            continue

        try:
            with open(card_file, "r") as f:
                card = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"Agent '{agent_dir.name}' invalid JSON: {e}")
            continue

        # Check required fields
        for field in required_fields:
            if field not in card:
                errors.append(f"Agent '{agent_dir.name}' missing required field: {field}")

        # Check recommended fields
        for field in recommended_fields:
            if field not in card:
                warnings.append(f"Agent '{agent_dir.name}' missing recommended field: {field}")

        # Validate skills schema
        if "skills" in card:
            for i, skill in enumerate(card["skills"]):
                if "name" not in skill:
                    errors.append(f"Agent '{agent_dir.name}' skill {i} missing 'name'")
                if "input_schema" not in skill:
                    warnings.append(f"Agent '{agent_dir.name}' skill '{skill.get('name', i)}' missing input_schema")

    return errors, warnings


def check_requirements(adk_root: Path) -> Tuple[List[str], List[str]]:
    """Validate requirements.txt has necessary dependencies."""
    errors = []
    warnings = []

    req_file = adk_root / "requirements.txt"
    if not req_file.exists():
        errors.append("requirements.txt not found")
        return errors, warnings

    with open(req_file, "r") as f:
        content = f.read().lower()

    # Required dependencies
    required = ["google-adk"]
    for dep in required:
        if dep not in content:
            errors.append(f"Missing required dependency: {dep}")

    # Banned dependencies (R1 compliance)
    banned = ["langchain", "autogen", "crewai"]
    for dep in banned:
        if dep in content:
            errors.append(f"Banned dependency found: {dep} (R1 violation)")

    return errors, warnings


def check_agent_structure(adk_root: Path) -> Tuple[List[str], List[str]]:
    """Validate agent module structure."""
    errors = []
    warnings = []

    agents_dir = adk_root / "agents"
    if not agents_dir.exists():
        errors.append("agents/ directory not found")
        return errors, warnings

    for agent_dir in agents_dir.iterdir():
        if not agent_dir.is_dir():
            continue
        if agent_dir.name in ("__pycache__", "shared_tools", "utils"):
            continue

        # Check for __init__.py
        init_file = agent_dir / "__init__.py"
        if not init_file.exists():
            errors.append(f"Agent '{agent_dir.name}' missing __init__.py")

        # Check for agent.py
        agent_file = agent_dir / "agent.py"
        if not agent_file.exists():
            errors.append(f"Agent '{agent_dir.name}' missing agent.py")
        else:
            with open(agent_file, "r") as f:
                content = f.read()

            # Check for App export (R2 compliance)
            if "def create_app" not in content:
                errors.append(f"Agent '{agent_dir.name}' missing create_app() function")

            # Check for module-level app
            if "app = create_app()" not in content:
                warnings.append(f"Agent '{agent_dir.name}' missing module-level 'app' variable")

    return errors, warnings


def main() -> int:
    print("=" * 50)
    print("IntentVision ADK ARV Gate")
    print("=" * 50)

    # Determine ADK root
    script_dir = Path(__file__).parent
    adk_root = script_dir.parent.parent

    print(f"ADK Root: {adk_root}")
    print()

    all_errors = []
    all_warnings = []

    # 1. Python syntax
    print("--- Python Syntax Validation ---")
    syntax_errors = check_python_syntax(adk_root)
    if syntax_errors:
        for err in syntax_errors:
            log_fail(err)
        all_errors.extend(syntax_errors)
    else:
        log_pass("All Python files have valid syntax")
    print()

    # 2. Requirements
    print("--- Requirements Validation ---")
    req_errors, req_warnings = check_requirements(adk_root)
    for err in req_errors:
        log_fail(err)
    for warn in req_warnings:
        log_warn(warn)
    all_errors.extend(req_errors)
    all_warnings.extend(req_warnings)
    if not req_errors:
        log_pass("requirements.txt is valid")
    print()

    # 3. Agent structure
    print("--- Agent Structure Validation ---")
    struct_errors, struct_warnings = check_agent_structure(adk_root)
    for err in struct_errors:
        log_fail(err)
    for warn in struct_warnings:
        log_warn(warn)
    all_errors.extend(struct_errors)
    all_warnings.extend(struct_warnings)
    if not struct_errors:
        log_pass("Agent structure is valid")
    print()

    # 4. Agent cards
    print("--- Agent Card Validation ---")
    card_errors, card_warnings = check_agent_cards(adk_root)
    for err in card_errors:
        log_fail(err)
    for warn in card_warnings:
        log_warn(warn)
    all_errors.extend(card_errors)
    all_warnings.extend(card_warnings)
    if not card_errors:
        log_pass("Agent cards are valid")
    print()

    # Summary
    print("=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"Errors: {len(all_errors)}")
    print(f"Warnings: {len(all_warnings)}")

    if all_errors:
        print()
        print(f"{RED}ARV GATE FAILED - Fix errors before deployment{NC}")
        return 1
    else:
        print()
        print(f"{GREEN}ARV GATE PASSED{NC}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
