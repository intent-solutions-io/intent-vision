#!/bin/bash
#
# AAR Beads Reference Validation
#
# Phase 3: Beads + AgentFS Discipline Layer
# Beads Task: intentvision-q37.5
#
# Checks that all AAR documents in 000-docs/ contain
# Beads task ID references as required by Doc-Filing v4.
#
# Usage:
#   ./scripts/ci/check-aar-beads.sh [--strict]
#
# Options:
#   --strict    Exit with error code 1 if any AAR lacks Beads references
#
# Exit codes:
#   0 - All AARs have Beads references (or no strict mode)
#   1 - One or more AARs missing Beads references (strict mode only)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCS_DIR="$REPO_ROOT/000-docs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
STRICT_MODE=false
if [[ "$1" == "--strict" ]]; then
    STRICT_MODE=true
fi

echo "========================================"
echo "AAR Beads Reference Validation"
echo "========================================"
echo ""

# Find all AAR files
AAR_FILES=$(find "$DOCS_DIR" -name "*-AA-AACR-*.md" -type f 2>/dev/null | sort)

if [[ -z "$AAR_FILES" ]]; then
    echo -e "${YELLOW}WARNING: No AAR files found in $DOCS_DIR${NC}"
    exit 0
fi

TOTAL_AARS=0
PASS_COUNT=0
FAIL_COUNT=0
FAILED_FILES=()

for file in $AAR_FILES; do
    TOTAL_AARS=$((TOTAL_AARS + 1))
    filename=$(basename "$file")

    # Check for Beads references
    # Look for:
    # - "Beads" or "beads" in any context
    # - Task ID patterns like intentvision-xxx, bd-xxx
    # - "Task ID" references
    if grep -qiE "(beads|task.?id|intentvision-[a-z0-9]+|bd-[a-z0-9]+)" "$file"; then
        echo -e "${GREEN}PASS${NC}: $filename"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}FAIL${NC}: $filename - Missing Beads/Task ID references"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAILED_FILES+=("$filename")
    fi
done

echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo "Total AARs:  $TOTAL_AARS"
echo -e "Passing:     ${GREEN}$PASS_COUNT${NC}"
echo -e "Failing:     ${RED}$FAIL_COUNT${NC}"
echo ""

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${YELLOW}AARs missing Beads references:${NC}"
    for f in "${FAILED_FILES[@]}"; do
        echo "  - $f"
    done
    echo ""
    echo "Per Doc-Filing v4, every AAR must include:"
    echo "  - 'Beads / Task IDs Touched' section"
    echo "  - At least one Task ID reference (intentvision-xxx or bd-xxx)"
    echo ""

    if [[ "$STRICT_MODE" == true ]]; then
        echo -e "${RED}STRICT MODE: Exiting with error${NC}"
        exit 1
    else
        echo -e "${YELLOW}WARNING MODE: Continuing despite failures${NC}"
        echo "Run with --strict to enforce Beads references"
    fi
fi

echo -e "${GREEN}AAR validation complete${NC}"
