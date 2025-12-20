#!/bin/bash
# IntentVision CI Check Script
# Phase 13: Production Deployment Infrastructure
#
# Usage: ./scripts/ci/arv-check.sh
#
# Runs linting and type checks equivalent to CI pipeline.
# Use this before pushing to catch issues early.
#
# Exit codes:
# 0 - All checks passed
# 1 - One or more checks failed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "============================================"
echo "    IntentVision CI Checks (Local)         "
echo "============================================"
echo ""

FAILED=0
PASSED=0

# =============================================================================
# Helper Functions
# =============================================================================

run_check() {
    local name="$1"
    shift
    local cmd=("$@")

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Check: $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if "${cmd[@]}"; then
        PASSED=$((PASSED + 1))
        echo "PASSED"
        echo ""
        return 0
    else
        FAILED=$((FAILED + 1))
        echo "FAILED"
        echo ""
        return 1
    fi
}

# =============================================================================
# Core CI Checks
# =============================================================================

echo "Running core CI checks..."
echo ""

# Check 1: TypeScript Type Checking
run_check "TypeScript Type Checking" npm run typecheck

# Check 2: Contract Tests
run_check "Contract Tests" npm run test:contracts

# Check 3: Pipeline Tests
run_check "Pipeline Tests" npm run test:pipeline

# Check 4: Operator Tests
run_check "Operator Tests" npm run test:operator

# =============================================================================
# Optional ARV Gate Checks (if scripts exist)
# =============================================================================

if [ -f "$SCRIPT_DIR/check-docs-flat.sh" ]; then
    echo "Running ARV Gate checks..."
    echo ""

    run_check "000-docs/ Flatness" bash "$SCRIPT_DIR/check-docs-flat.sh" || true
    run_check "6767 Standards Present" bash "$SCRIPT_DIR/check-standards-present.sh" || true
    run_check "AAR Template Valid" bash "$SCRIPT_DIR/check-aar-template.sh" || true
    run_check "Phase AARs Exist" bash "$SCRIPT_DIR/check-phase-aars.sh" || true
    run_check "Task IDs in Commits" bash "$SCRIPT_DIR/check-task-ids.sh" || true
    run_check "Lint/Formatting" bash "$SCRIPT_DIR/check-lint.sh" || true
    run_check "Security Scan" bash "$SCRIPT_DIR/check-security.sh" || true
fi

# =============================================================================
# Summary
# =============================================================================

echo "============================================"
echo "             CHECK SUMMARY                  "
echo "============================================"
echo ""
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ "$FAILED" -gt 0 ]; then
    echo "FAILED - Fix the above issues before pushing"
    echo ""
    exit 1
else
    echo "PASSED - All checks successful!"
    echo ""
    exit 0
fi
