#!/bin/bash
# Simple Oracle Test Script
# Tests that contracts are deployed and oracle is working

set -e

echo "🧪 Oracle Simple Test"
echo "===================="
echo ""

# Check Anvil
echo "1. Checking Anvil..."
if cast block-number --rpc-url http://localhost:8545 > /dev/null 2>&1; then
  echo "✅ Anvil running"
else
  echo "❌ Anvil not running"
  echo "Start with: docker-compose up -d anvil"
  exit 1
fi

# Check oracle deployed
echo ""
echo "2. Checking oracle contract..."
if [ -z "$NEXT_PUBLIC_BABYLON_ORACLE" ]; then
  echo "❌ NEXT_PUBLIC_BABYLON_ORACLE not set"
  echo "Deploy with: bun run contracts:deploy:local"
  exit 1
fi

CODE=$(cast code $NEXT_PUBLIC_BABYLON_ORACLE --rpc-url http://localhost:8545)
if [ "$CODE" == "0x" ]; then
  echo "❌ Oracle not deployed at $NEXT_PUBLIC_BABYLON_ORACLE"
  exit 1
fi
echo "✅ Oracle deployed at $NEXT_PUBLIC_BABYLON_ORACLE"

# Check predimarket deployed
echo ""
echo "3. Checking predimarket contract..."
if [ -z "$NEXT_PUBLIC_PREDIMARKET" ]; then
  echo "❌ NEXT_PUBLIC_PREDIMARKET not set"
  exit 1
fi

CODE=$(cast code $NEXT_PUBLIC_PREDIMARKET --rpc-url http://localhost:8545)
if [ "$CODE" == "0x" ]; then
  echo "❌ Predimarket not deployed at $NEXT_PUBLIC_PREDIMARKET"
  exit 1
fi
echo "✅ Predimarket deployed at $NEXT_PUBLIC_PREDIMARKET"

# Get oracle statistics
echo ""
echo "4. Getting oracle statistics..."
STATS=$(cast call $NEXT_PUBLIC_BABYLON_ORACLE "getStatistics()" --rpc-url http://localhost:8545)
echo "✅ Oracle statistics:"
echo "   Raw: $STATS"

# Get oracle version
echo ""
echo "5. Checking oracle version..."
VERSION=$(cast call $NEXT_PUBLIC_BABYLON_ORACLE "version()" --rpc-url http://localhost:8545)
echo "✅ Oracle version: $VERSION"

echo ""
echo "===================="
echo "✨ All checks passed!"
echo "===================="
echo ""
echo "Run full E2E test:"
echo "  bun run scripts/test-oracle-e2e.ts"
echo ""
echo "Or run Solidity tests:"
echo "  forge test --match-contract BabylonGameOracleTest"

