#!/bin/bash
# Check that at least one phase AAR exists
# ARV Gate: Phase documentation compliance

set -e

echo "Checking for phase AARs..."

# Look for AAR files (NNN-AA-AACR-* pattern)
AAR_COUNT=$(find 000-docs -name "*-AA-AACR-*.md" -type f 2>/dev/null | wc -l)

if [ "$AAR_COUNT" -eq 0 ]; then
    echo "❌ FAIL: No phase AARs found in 000-docs/"
    echo "Expected files matching pattern: NNN-AA-AACR-*.md"
    exit 1
fi

echo "Found $AAR_COUNT AAR(s):"
find 000-docs -name "*-AA-AACR-*.md" -type f | while read f; do
    echo "  - $(basename $f)"
done

echo ""
echo "✅ PASS: Phase AAR(s) present"
