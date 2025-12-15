#!/bin/bash
# Security scanning baseline
# ARV Gate: Security compliance

set -e

echo "Running security scans..."

ERRORS=0

# Check for potential secrets in code
echo "Scanning for potential secrets..."

SECRET_PATTERNS=(
    'AKIA[0-9A-Z]{16}'           # AWS Access Key
    'sk-[a-zA-Z0-9]{48}'         # OpenAI API Key
    'ghp_[a-zA-Z0-9]{36}'        # GitHub Personal Access Token
    'gho_[a-zA-Z0-9]{36}'        # GitHub OAuth Token
    'AIza[0-9A-Za-z-_]{35}'      # Google API Key
    'password\s*=\s*["\x27][^"\x27]+'  # Hardcoded passwords
    'api[_-]?key\s*=\s*["\x27][^"\x27]+'  # API keys
)

# Files to scan (exclude .git, node_modules, etc.)
SCAN_DIRS="000-docs scripts services packages infrastructure tools"

for pattern in "${SECRET_PATTERNS[@]}"; do
    MATCHES=$(grep -rE "$pattern" $SCAN_DIRS 2>/dev/null | grep -v ".example" | grep -v "test" || true)
    if [ -n "$MATCHES" ]; then
        echo "❌ POTENTIAL SECRET FOUND:"
        echo "$MATCHES" | head -5
        ERRORS=$((ERRORS + 1))
    fi
done

# Check for forbidden files
echo "Checking for forbidden files..."
FORBIDDEN_PATTERNS=(
    "*.pem"
    "*.key"
    "*credentials*.json"
    "*service-account*.json"
    ".env"
    ".env.local"
    "*.env"
)

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    FOUND=$(find . -name "$pattern" -not -path "./.git/*" 2>/dev/null | wc -l)
    if [ "$FOUND" -gt 0 ]; then
        echo "❌ FORBIDDEN FILE PATTERN: $pattern ($FOUND found)"
        find . -name "$pattern" -not -path "./.git/*" 2>/dev/null
        ERRORS=$((ERRORS + 1))
    fi
done

# Check .gitignore includes security patterns
echo "Checking .gitignore security patterns..."
if [ -f ".gitignore" ]; then
    REQUIRED_IGNORES=(".env" "*.pem" "*.key" "credentials.json")
    for ignore in "${REQUIRED_IGNORES[@]}"; do
        if ! grep -q "$ignore" .gitignore 2>/dev/null; then
            echo "⚠️  Missing from .gitignore: $ignore"
        fi
    done
fi

if [ "$ERRORS" -gt 0 ]; then
    echo ""
    echo "❌ FAIL: Security scan found $ERRORS issue(s)"
    exit 1
fi

echo ""
echo "✅ PASS: Security scans passed"
