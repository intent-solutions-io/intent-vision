#!/bin/bash
# Basic lint/formatting checks
# ARV Gate: Code quality baseline

set -e

echo "Running lint checks..."

ERRORS=0

# Check for trailing whitespace in markdown
echo "Checking markdown files for trailing whitespace..."
TRAILING_WS=$(find 000-docs -name "*.md" -exec grep -l ' $' {} \; 2>/dev/null | wc -l)
if [ "$TRAILING_WS" -gt 0 ]; then
    echo "⚠️  Found $TRAILING_WS files with trailing whitespace"
    # Soft warning, don't fail
fi

# Check for consistent line endings (no CRLF)
echo "Checking for CRLF line endings..."
CRLF_FILES=$(find . -type f -name "*.md" -o -name "*.sh" -o -name "*.yaml" -o -name "*.yml" 2>/dev/null | xargs file 2>/dev/null | grep -c "CRLF" || true)
if [ "$CRLF_FILES" -gt 0 ]; then
    echo "❌ FAIL: Found $CRLF_FILES files with CRLF line endings"
    ERRORS=$((ERRORS + 1))
fi

# Check shell scripts are executable
echo "Checking shell script permissions..."
find scripts -name "*.sh" -type f 2>/dev/null | while read script; do
    if [ ! -x "$script" ]; then
        echo "⚠️  Script not executable: $script"
    fi
done

# Check YAML syntax (if yq or python available)
echo "Checking YAML syntax..."
if command -v python3 &>/dev/null; then
    find . -name "*.yaml" -o -name "*.yml" 2>/dev/null | while read yaml; do
        if ! python3 -c "import yaml; yaml.safe_load(open('$yaml'))" 2>/dev/null; then
            echo "❌ Invalid YAML: $yaml"
            ERRORS=$((ERRORS + 1))
        fi
    done
fi

if [ "$ERRORS" -gt 0 ]; then
    echo ""
    echo "❌ FAIL: Lint check found $ERRORS error(s)"
    exit 1
fi

echo ""
echo "✅ PASS: Lint checks passed"
