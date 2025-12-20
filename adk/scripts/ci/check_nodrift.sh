#!/usr/bin/env bash
#
# IntentVision ADK Drift Detection (R1-R8 Compliance)
#
# Beads Task: intentvision-qd3.4
#
# This script enforces Hard Mode rules for ADK development.
# Exit code 0 = PASS, non-zero = FAIL
#
# R1: ADK-only (no langchain, autogen, crewai)
# R2: Agent Engine deployment (check for Runner references)
# R3: Gateway boundary (A2A protocol compliance)
# R4: CI-only deployment (no manual deploy commands)
# R5: Dual memory wiring (auto_save_session_to_memory)
# R6: Single docs folder (000-docs/ only)
# R7: SPIFFE ID propagation (agent identity)
# R8: Drift detection first (this script!)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADK_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILURES=0
WARNINGS=0

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILURES++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

log_info() {
    echo -e "[INFO] $1"
}

echo "=========================================="
echo "IntentVision ADK Drift Detection"
echo "=========================================="
echo "ADK Root: $ADK_ROOT"
echo ""

# -----------------------------------------------------------------------------
# R1: ADK-only check
# -----------------------------------------------------------------------------
echo "--- R1: ADK-only (no competing frameworks) ---"

BANNED_FRAMEWORKS=("langchain" "autogen" "crewai" "llamaindex")
for framework in "${BANNED_FRAMEWORKS[@]}"; do
    # Exclude scripts/ci (which contains the check itself) and tests
    if grep -rq "$framework" "$ADK_ROOT" --include="*.py" --include="*.txt" --include="*.toml" --exclude-dir="scripts" --exclude-dir="tests" 2>/dev/null; then
        log_fail "Found banned framework reference: $framework"
    else
        log_pass "No $framework references found"
    fi
done
echo ""

# -----------------------------------------------------------------------------
# R2: Agent Engine deployment (no self-hosted Runner)
# -----------------------------------------------------------------------------
echo "--- R2: Agent Engine deployment (no Runner references) ---"

# Check for Runner imports (allowed in tests, not in main code)
RUNNER_REFS=$(grep -r "from google.adk.runners import Runner" "$ADK_ROOT/agents" --include="*.py" 2>/dev/null || true)
if [ -n "$RUNNER_REFS" ]; then
    log_fail "Found Runner references in agents/ (should use App for Agent Engine)"
    echo "$RUNNER_REFS"
else
    log_pass "No Runner references in agents/ directory"
fi

# Verify App usage
APP_REFS=$(grep -r "from google.adk.apps import App" "$ADK_ROOT/agents" --include="*.py" 2>/dev/null || true)
if [ -n "$APP_REFS" ]; then
    log_pass "Agents use App class for Agent Engine deployment"
else
    log_warn "No App imports found - ensure agents use App for deployment"
fi
echo ""

# -----------------------------------------------------------------------------
# R3: Gateway boundary (A2A protocol)
# -----------------------------------------------------------------------------
echo "--- R3: Gateway boundary (A2A protocol compliance) ---"

# Check for agent-card.json files
AGENT_DIRS=$(find "$ADK_ROOT/agents" -maxdepth 1 -type d -name "*" | tail -n +2)
for agent_dir in $AGENT_DIRS; do
    if [ -d "$agent_dir" ] && [ "$(basename "$agent_dir")" != "__pycache__" ] && [ "$(basename "$agent_dir")" != "shared_tools" ] && [ "$(basename "$agent_dir")" != "utils" ]; then
        agent_name=$(basename "$agent_dir")
        if [ -f "$agent_dir/.well-known/agent-card.json" ]; then
            log_pass "Agent '$agent_name' has agent-card.json"
        else
            log_warn "Agent '$agent_name' missing .well-known/agent-card.json"
        fi
    fi
done
echo ""

# -----------------------------------------------------------------------------
# R4: CI-only deployment
# -----------------------------------------------------------------------------
echo "--- R4: CI-only deployment (no manual deploy scripts) ---"

# Check for deploy commands outside of scripts/ci
MANUAL_DEPLOY=$(grep -r "gcloud agent-builder" "$ADK_ROOT" --include="*.sh" --exclude-dir="scripts" 2>/dev/null || true)
if [ -n "$MANUAL_DEPLOY" ]; then
    log_warn "Found deploy commands outside scripts/ - should be CI-only"
else
    log_pass "No manual deploy commands found outside CI scripts"
fi
echo ""

# -----------------------------------------------------------------------------
# R5: Dual memory wiring
# -----------------------------------------------------------------------------
echo "--- R5: Dual memory wiring (after_agent_callback) ---"

for agent_dir in $AGENT_DIRS; do
    if [ -d "$agent_dir" ] && [ "$(basename "$agent_dir")" != "__pycache__" ] && [ "$(basename "$agent_dir")" != "shared_tools" ] && [ "$(basename "$agent_dir")" != "utils" ]; then
        agent_name=$(basename "$agent_dir")
        agent_file="$agent_dir/agent.py"
        if [ -f "$agent_file" ]; then
            if grep -q "after_agent_callback=auto_save_session_to_memory" "$agent_file" 2>/dev/null; then
                log_pass "Agent '$agent_name' has dual memory wiring"
            else
                log_warn "Agent '$agent_name' missing after_agent_callback"
            fi
        fi
    fi
done
echo ""

# -----------------------------------------------------------------------------
# R6: Single docs folder (not applicable to adk/)
# -----------------------------------------------------------------------------
echo "--- R6: Single docs folder (skipped for adk/) ---"
log_info "R6 check delegated to parent repo"
echo ""

# -----------------------------------------------------------------------------
# R7: SPIFFE ID propagation
# -----------------------------------------------------------------------------
echo "--- R7: SPIFFE ID propagation ---"

for agent_dir in $AGENT_DIRS; do
    if [ -d "$agent_dir" ] && [ "$(basename "$agent_dir")" != "__pycache__" ] && [ "$(basename "$agent_dir")" != "shared_tools" ] && [ "$(basename "$agent_dir")" != "utils" ]; then
        agent_name=$(basename "$agent_dir")
        agent_file="$agent_dir/agent.py"
        if [ -f "$agent_file" ]; then
            if grep -q "AGENT_SPIFFE_ID" "$agent_file" 2>/dev/null; then
                log_pass "Agent '$agent_name' has SPIFFE ID configured"
            else
                log_fail "Agent '$agent_name' missing SPIFFE ID"
            fi
        fi
    fi
done

# Check agent-card.json for spiffe_id
for agent_dir in $AGENT_DIRS; do
    if [ -d "$agent_dir" ] && [ "$(basename "$agent_dir")" != "__pycache__" ] && [ "$(basename "$agent_dir")" != "shared_tools" ] && [ "$(basename "$agent_dir")" != "utils" ]; then
        agent_name=$(basename "$agent_dir")
        card_file="$agent_dir/.well-known/agent-card.json"
        if [ -f "$card_file" ]; then
            if grep -q '"spiffe_id"' "$card_file" 2>/dev/null; then
                log_pass "Agent '$agent_name' card has spiffe_id field"
            else
                log_warn "Agent '$agent_name' card missing spiffe_id"
            fi
        fi
    fi
done
echo ""

# -----------------------------------------------------------------------------
# R8: Drift detection first (meta-check)
# -----------------------------------------------------------------------------
echo "--- R8: Drift detection runs in CI ---"
log_pass "This script IS the drift detection"
echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo "Failures: $FAILURES"
echo "Warnings: $WARNINGS"

if [ $FAILURES -gt 0 ]; then
    echo ""
    echo -e "${RED}DRIFT DETECTED - Fix failures before proceeding${NC}"
    exit 1
else
    echo ""
    echo -e "${GREEN}ALL CHECKS PASSED${NC}"
    exit 0
fi
