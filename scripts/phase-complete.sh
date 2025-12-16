#!/bin/bash
#
# Phase Completion Utility Script
#
# Phase 5: Customer Onboarding + Org/API Key Flow
# Beads Task: intentvision-p5
#
# Generates a summary of files changed, validates beads status,
# and checks AgentFS snapshots for phase completion documentation.
#
# Usage: ./scripts/phase-complete.sh [phase-number]
#

set -e

PHASE=${1:-"5"}
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

echo "========================================"
echo "IntentVision Phase $PHASE Completion Check"
echo "========================================"
echo ""

# 1. Git status summary
echo "1. Git Status Summary"
echo "----------------------------------------"
MODIFIED=$(git diff --name-only 2>/dev/null | wc -l)
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l)

echo "  Modified files:  $MODIFIED"
echo "  Staged files:    $STAGED"
echo "  Untracked files: $UNTRACKED"
echo ""

# 2. Files changed by category
echo "2. Files Changed by Category"
echo "----------------------------------------"

# Schema changes
SCHEMA_CHANGES=$(git diff --name-only 2>/dev/null | grep -E "schema\.(ts|js)" | wc -l || echo "0")
echo "  Schema files:     $SCHEMA_CHANGES"

# Route changes
ROUTE_CHANGES=$(git diff --name-only 2>/dev/null | grep -E "routes/.*\.(ts|js)" | wc -l || echo "0")
echo "  Route files:      $ROUTE_CHANGES"

# Service changes
SERVICE_CHANGES=$(git diff --name-only 2>/dev/null | grep -E "services/.*\.(ts|js)" | wc -l || echo "0")
echo "  Service files:    $SERVICE_CHANGES"

# Frontend changes
FRONTEND_CHANGES=$(git diff --name-only 2>/dev/null | grep -E "web/.*\.(tsx|ts|jsx|js)" | wc -l || echo "0")
echo "  Frontend files:   $FRONTEND_CHANGES"

# Test changes
TEST_CHANGES=$(git diff --name-only 2>/dev/null | grep -E "test.*\.(ts|js)" | wc -l || echo "0")
echo "  Test files:       $TEST_CHANGES"

# Doc changes
DOC_CHANGES=$(git diff --name-only 2>/dev/null | grep -E "\.md$" | wc -l || echo "0")
echo "  Documentation:    $DOC_CHANGES"
echo ""

# 3. Beads status check
echo "3. Beads Status Check"
echo "----------------------------------------"
BEADS_FILE="$REPO_ROOT/.beads/issues.jsonl"
if [ -f "$BEADS_FILE" ]; then
    TOTAL_TASKS=$(wc -l < "$BEADS_FILE")
    COMPLETED=$(grep -c '"status":"completed"' "$BEADS_FILE" 2>/dev/null || echo "0")
    IN_PROGRESS=$(grep -c '"status":"in_progress"' "$BEADS_FILE" 2>/dev/null || echo "0")

    echo "  Beads file:       $BEADS_FILE"
    echo "  Total tasks:      $TOTAL_TASKS"
    echo "  Completed:        $COMPLETED"
    echo "  In progress:      $IN_PROGRESS"

    # Check for phase-specific tasks
    PHASE_TASKS=$(grep -c "p${PHASE}" "$BEADS_FILE" 2>/dev/null || echo "0")
    echo "  Phase $PHASE tasks: $PHASE_TASKS"
else
    echo "  WARNING: Beads file not found at $BEADS_FILE"
fi
echo ""

# 4. AgentFS snapshot check
echo "4. AgentFS Snapshot Check"
echo "----------------------------------------"
AGENTFS_DIR="$REPO_ROOT/.agentfs"
if [ -d "$AGENTFS_DIR" ]; then
    SNAPSHOT_COUNT=$(ls -1 "$AGENTFS_DIR" 2>/dev/null | wc -l)
    echo "  AgentFS directory: $AGENTFS_DIR"
    echo "  Snapshots:         $SNAPSHOT_COUNT"

    # Show recent snapshots
    if [ "$SNAPSHOT_COUNT" -gt 0 ]; then
        echo "  Recent snapshots:"
        ls -lt "$AGENTFS_DIR" 2>/dev/null | head -5 | while read line; do
            echo "    $line"
        done
    fi
else
    echo "  AgentFS directory not found (optional)"
fi
echo ""

# 5. AAR document check
echo "5. AAR Document Check"
echo "----------------------------------------"
AAR_DIR="$REPO_ROOT/000-docs"
if [ -d "$AAR_DIR" ]; then
    # Find phase-specific AAR
    PHASE_AAR=$(ls "$AAR_DIR"/*-phase-${PHASE}*.md 2>/dev/null | head -1 || echo "")
    if [ -n "$PHASE_AAR" ]; then
        echo "  Phase $PHASE AAR:  $PHASE_AAR"
        echo "  Status:           FOUND"
    else
        echo "  Phase $PHASE AAR:  NOT FOUND"
        echo "  Expected:         000-docs/*-phase-${PHASE}*.md"
    fi
else
    echo "  WARNING: Docs directory not found at $AAR_DIR"
fi
echo ""

# 6. TypeScript check
echo "6. TypeScript Compilation Check"
echo "----------------------------------------"
if [ -f "$REPO_ROOT/packages/api/package.json" ]; then
    cd "$REPO_ROOT/packages/api"
    if npx tsc --noEmit 2>/dev/null; then
        echo "  packages/api:     PASS"
    else
        echo "  packages/api:     FAIL (run 'npx tsc --noEmit' for details)"
    fi
fi
echo ""

# 7. Summary
echo "========================================"
echo "Phase $PHASE Completion Summary"
echo "========================================"

READY=true

if [ "$UNTRACKED" -gt 0 ] || [ "$MODIFIED" -gt 0 ]; then
    echo "  [ ] Uncommitted changes present"
    READY=false
else
    echo "  [x] All changes committed"
fi

if [ -f "$BEADS_FILE" ]; then
    echo "  [x] Beads file present"
else
    echo "  [ ] Beads file missing"
    READY=false
fi

if [ -n "$PHASE_AAR" ] && [ -f "$PHASE_AAR" ]; then
    echo "  [x] Phase AAR document present"
else
    echo "  [ ] Phase AAR document missing"
    READY=false
fi

echo ""
if [ "$READY" = true ]; then
    echo "Status: READY FOR MERGE"
else
    echo "Status: PENDING ITEMS ABOVE"
fi
echo ""
echo "========================================"
