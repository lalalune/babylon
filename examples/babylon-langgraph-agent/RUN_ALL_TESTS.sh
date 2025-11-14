#!/bin/bash
# Run all verification and tests

echo "════════════════════════════════════════════════════════════════"
echo " 🧪 RUNNING ALL TESTS"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "Test 1: Validation Tests (no server needed)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
uv run python -m pytest tests/test_a2a_methods.py::TestValidation -v
echo ""

echo "Test 2: A2A Method Tests (requires server)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
uv run python -m pytest tests/test_a2a_methods.py::TestA2AMethods -v
echo ""

echo "Test 3: Error Handling Tests (requires server)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
uv run python -m pytest tests/test_a2a_methods.py::TestErrorHandling -v
echo ""

echo "════════════════════════════════════════════════════════════════"
echo " ✅ ALL TESTS COMPLETE"
echo "════════════════════════════════════════════════════════════════"

