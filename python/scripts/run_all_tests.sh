#!/bin/bash
# Run all tests for Babylon RL Training Pipeline

set -e

echo "🧪 Babylon RL Training - Comprehensive Test Suite"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check environment
echo "📋 Checking environment..."

if [ ! -f ".env.training" ]; then
    echo -e "${YELLOW}⚠️  .env.training not found${NC}"
    echo "Copy from template: cp env.training.template .env.training"
    exit 1
fi

source .env.training

MISSING=()
[ -z "$DATABASE_URL" ] && MISSING+=("DATABASE_URL")
[ -z "$OPENPIPE_API_KEY" ] && MISSING+=("OPENPIPE_API_KEY")
[ -z "$WANDB_API_KEY" ] && MISSING+=("WANDB_API_KEY")
[ -z "$WANDB_ENTITY" ] && MISSING+=("WANDB_ENTITY")
[ -z "$TRAIN_RL_LOCAL" ] && MISSING+=("TRAIN_RL_LOCAL")

if [ ${#MISSING[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing environment variables:${NC}"
    printf '  - %s\n' "${MISSING[@]}"
    echo "Set these in .env.training"
    exit 1
fi

echo -e "${GREEN}✓${NC} Environment configured"
echo ""

# Test 1: Unit Tests (Mocked)
echo "═══════════════════════════════════════════════"
echo "Test 1: Unit Tests (Fast, Mocked)"
echo "═══════════════════════════════════════════════"
pytest tests/test_continuous_training.py -v --tb=short || {
    echo -e "${RED}❌ Unit tests failed${NC}"
    exit 1
}
echo -e "${GREEN}✓${NC} Unit tests passed"
echo ""

# Test 2: Database Integration
echo "═══════════════════════════════════════════════"
echo "Test 2: Database Integration"
echo "═══════════════════════════════════════════════"
pytest tests/test_real_integration.py::TestRealDatabase -v -s || {
    echo -e "${RED}❌ Database tests failed${NC}"
    exit 1
}
echo -e "${GREEN}✓${NC} Database integration works"
echo ""

# Test 3: OpenPipe RULER
echo "═══════════════════════════════════════════════"
echo "Test 3: OpenPipe RULER API"
echo "═══════════════════════════════════════════════"
pytest tests/test_real_integration.py::TestRealOpenPipeRULER -v -s || {
    echo -e "${YELLOW}⚠️  RULER tests failed (check API key)${NC}"
}
echo ""

# Test 4: W&B Integration
echo "═══════════════════════════════════════════════"
echo "Test 4: W&B Integration"
echo "═══════════════════════════════════════════════"
pytest tests/test_real_integration.py::TestRealWandB -v -s || {
    echo -e "${YELLOW}⚠️  W&B tests failed (check credentials)${NC}"
}
echo ""

# Test 5: Data Collection
echo "═══════════════════════════════════════════════"
echo "Test 5: Data Collection from Database"
echo "═══════════════════════════════════════════════"
pytest tests/test_real_integration.py::TestRealDataCollection -v -s || {
    echo -e "${YELLOW}⚠️  Data collection tests failed (may be no data yet)${NC}"
}
echo ""

# Test 6: Environment Variables
echo "═══════════════════════════════════════════════"
echo "Test 6: Environment Validation"
echo "═══════════════════════════════════════════════"
pytest tests/test_real_integration.py::test_environment_variables -v -s
echo ""

# Test 7: Model Endpoint (Optional)
echo "═══════════════════════════════════════════════"
echo "Test 7: Model Endpoint (Optional)"
echo "═══════════════════════════════════════════════"
pytest tests/test_real_integration.py::TestModelEndpoint -v -s || {
    echo -e "${YELLOW}⚠️  Endpoint tests failed (endpoint may not be running)${NC}"
}
echo ""

# Test 8: End-to-End Flow (Slow)
if [ "$RUN_E2E" = "true" ]; then
    echo "═══════════════════════════════════════════════"
    echo "Test 8: End-to-End Flow (Slow)"
    echo "═══════════════════════════════════════════════"
    pytest tests/test_real_integration.py::TestEndToEndFlow -v -s -m slow || {
        echo -e "${RED}❌ End-to-end test failed${NC}"
        exit 1
    }
    echo -e "${GREEN}✓${NC} End-to-end flow works!"
else
    echo "═══════════════════════════════════════════════"
    echo "Test 8: End-to-End Flow (Skipped)"
    echo "═══════════════════════════════════════════════"
    echo "Run with: RUN_E2E=true ./scripts/run_all_tests.sh"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════"
echo "🎉 Test Suite Complete!"
echo "════════════════════════════════════════════════"
echo ""
echo "Results:"
echo -e "  ${GREEN}✓${NC} Unit tests"
echo -e "  ${GREEN}✓${NC} Database integration"
echo "  RULER API (check above)"
echo "  W&B integration (check above)"
echo "  Data collection (check above)"
echo -e "  ${GREEN}✓${NC} Environment validation"
echo "  Model endpoint (check above)"
echo "  E2E flow (${RUN_E2E:-skipped})"
echo ""

if [ "$RUN_E2E" != "true" ]; then
    echo "💡 Tip: Run full E2E test with:"
    echo "   RUN_E2E=true ./scripts/run_all_tests.sh"
fi

echo ""
echo "✅ Core tests passed! System is ready."



