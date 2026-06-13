#!/usr/bin/env sh
# Taichu Pre-Commit Hook — lint + test gate
# Install: node scripts/setup-hooks.js

set -e

echo "🔍 Running pre-commit checks..."

# 1. Lint check (errors only block)
echo "  → ESLint..."
npx eslint . --quiet 2>/dev/null
if [ $? -ne 0 ]; then
  echo "  ❌ ESLint found errors. Run 'npm run lint:fix' to auto-fix."
  exit 1
fi
echo "  ✅ Lint passed"

# 2. Test suite
echo "  → Tests..."
npm test -- --test-reporter=spec 2>/dev/null
if [ $? -ne 0 ]; then
  echo "  ❌ Tests failed."
  exit 1
fi
echo "  ✅ Tests passed"

# 3. Admin build check (staged .vue/.js changes only)
STAGED=$(git diff --cached --name-only | grep -E '\.vue$|packages/admin/src/.*\.js$' || true)
if [ -n "$STAGED" ]; then
  echo "  → Admin build..."
  cd packages/admin && npx vite build --logLevel error 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "  ❌ Admin build failed."
    exit 1
  fi
  echo "  ✅ Admin build passed"
fi

echo "🎉 All checks passed!"
