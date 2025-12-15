#!/bin/bash
# Check that 000-docs/ is strictly flat (no subdirectories)
# ARV Gate: Doc filing compliance

set -e

echo "Checking 000-docs/ flatness..."

# Check if 000-docs exists
if [ ! -d "000-docs" ]; then
    echo "❌ FAIL: 000-docs/ directory does not exist"
    exit 1
fi

# Count subdirectories (should be 1 - just 000-docs itself)
SUBDIR_COUNT=$(find 000-docs -type d | wc -l)

if [ "$SUBDIR_COUNT" -ne 1 ]; then
    echo "❌ FAIL: 000-docs/ contains subdirectories"
    echo "Found directories:"
    find 000-docs -type d
    exit 1
fi

# Count files
FILE_COUNT=$(find 000-docs -type f -name "*.md" | wc -l)
echo "✅ PASS: 000-docs/ is flat with $FILE_COUNT markdown files"
