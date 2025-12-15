#!/bin/bash
# Check that AAR template (6767-b) is present
# ARV Gate: AAR compliance

set -e

echo "Checking AAR template..."

AAR_TEMPLATE="000-docs/6767-b-AA-TMPL-after-action-report-template.md"

if [ ! -f "$AAR_TEMPLATE" ]; then
    echo "❌ FAIL: AAR template not found at $AAR_TEMPLATE"
    exit 1
fi

# Check that template has required sections
REQUIRED_SECTIONS=(
    "Metadata"
    "Beads / Task IDs Touched"
    "Executive Summary"
    "What Changed"
    "Evidence Links"
)

MISSING=0

for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -q "## $section" "$AAR_TEMPLATE"; then
        echo "❌ MISSING SECTION: $section"
        MISSING=$((MISSING + 1))
    fi
done

if [ "$MISSING" -gt 0 ]; then
    echo ""
    echo "❌ FAIL: AAR template missing $MISSING required section(s)"
    exit 1
fi

echo "✅ PASS: AAR template present with all required sections"
