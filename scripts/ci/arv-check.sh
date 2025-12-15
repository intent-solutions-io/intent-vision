#!/bin/bash
# Local ARV Check - runs same checks as CI
# Usage: ./scripts/ci/arv-check.sh
#
# This script runs locally what the ARV Gate CI would run.
# Use this before pushing to catch issues early.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "============================================"
echo "       IntentVision ARV Gate (Local)       "
echo "============================================"
echo ""

FAILED=0
PASSED=0

run_check() {
    local name="$1"
    local script="$2"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if bash "$script"; then
        PASSED=$((PASSED + 1))
        echo ""
    else
        FAILED=$((FAILED + 1))
        echo ""
    fi
}

# Run all checks
run_check "000-docs/ Flatness" "$SCRIPT_DIR/check-docs-flat.sh"
run_check "6767 Standards Present" "$SCRIPT_DIR/check-standards-present.sh"
run_check "AAR Template Valid" "$SCRIPT_DIR/check-aar-template.sh"
run_check "Phase AARs Exist" "$SCRIPT_DIR/check-phase-aars.sh"
run_check "Task IDs in Commits" "$SCRIPT_DIR/check-task-ids.sh"
run_check "Lint/Formatting" "$SCRIPT_DIR/check-lint.sh"
run_check "Security Scan" "$SCRIPT_DIR/check-security.sh"

# Summary
echo "============================================"
echo "               ARV SUMMARY                  "
echo "============================================"
echo ""
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""

if [ "$FAILED" -gt 0 ]; then
    echo "❌ ARV GATE: FAILED"
    echo ""
    echo "Fix the above issues before pushing."
    exit 1
else
    echo "✅ ARV GATE: PASSED"
    echo ""
    echo "Ready to push!"
    exit 0
fi
