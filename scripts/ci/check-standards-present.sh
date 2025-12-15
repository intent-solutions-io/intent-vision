#!/bin/bash
# Check that required 6767 standards are present
# ARV Gate: Standards compliance

set -e

echo "Checking required 6767 standards..."

REQUIRED_STANDARDS=(
    "6767-a-DR-STND-document-filing-system-standard"
    "6767-b-AA-TMPL-after-action-report-template"
)

MISSING=0

for std in "${REQUIRED_STANDARDS[@]}"; do
    if ! ls 000-docs/${std}*.md >/dev/null 2>&1; then
        echo "❌ MISSING: $std"
        MISSING=$((MISSING + 1))
    else
        echo "✅ FOUND: $std"
    fi
done

if [ "$MISSING" -gt 0 ]; then
    echo ""
    echo "❌ FAIL: $MISSING required standard(s) missing"
    exit 1
fi

echo ""
echo "✅ PASS: All required standards present"
