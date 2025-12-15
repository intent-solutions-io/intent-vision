#!/bin/bash
# Check that recent commits reference task IDs
# ARV Gate: Traceability compliance
# Best-effort check - warns but doesn't fail for older commits

set -e

echo "Checking task IDs in recent commits..."

# Check last 5 commits (configurable)
COMMITS_TO_CHECK=${COMMITS_TO_CHECK:-5}

# Task ID patterns: bd-xxxx, IV-xxx, TASK-xxx
TASK_PATTERN='(\[Task:|\[Tasks:|bd-[a-z0-9]+|IV-[0-9]+|TASK-[a-zA-Z0-9-]+)'

WARNINGS=0
CHECKED=0

# Get recent commit messages
git log --format="%h %s" -n "$COMMITS_TO_CHECK" 2>/dev/null | while read hash subject; do
    CHECKED=$((CHECKED + 1))

    # Get full commit message
    FULL_MSG=$(git log --format="%B" -n 1 "$hash" 2>/dev/null)

    if echo "$FULL_MSG" | grep -qE "$TASK_PATTERN"; then
        echo "✅ $hash: Task ID found"
    else
        echo "⚠️  $hash: No task ID found in: $subject"
        WARNINGS=$((WARNINGS + 1))
    fi
done

echo ""
if [ "$WARNINGS" -gt 0 ]; then
    echo "⚠️  WARNING: $WARNINGS of $COMMITS_TO_CHECK recent commits missing task IDs"
    echo "   (This is a soft warning - commits should reference task IDs per 6767-f)"
else
    echo "✅ PASS: All recent commits have task IDs"
fi

# Don't fail on task ID warnings (soft check)
exit 0
