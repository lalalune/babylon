#!/bin/bash

# Moderation Testing Script
# Runs all moderation-related tests (integration + e2e)

set -e

echo "🧪 Babylon Moderation Test Suite"
echo "================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Parse arguments
RUN_INTEGRATION=true
RUN_E2E=false
SEED_DATA=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --e2e)
            RUN_E2E=true
            shift
            ;;
        --seed)
            SEED_DATA=true
            shift
            ;;
        --integration-only)
            RUN_E2E=false
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: ./scripts/test-moderation.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --e2e              Run E2E tests in addition to integration tests"
            echo "  --seed             Seed test data before running tests"
            echo "  --integration-only Run only integration tests (default)"
            echo "  --verbose          Show verbose test output"
            echo "  --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./scripts/test-moderation.sh                    # Run integration tests only"
            echo "  ./scripts/test-moderation.sh --e2e              # Run all tests"
            echo "  ./scripts/test-moderation.sh --seed --e2e       # Seed data and run all tests"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Seed test data if requested
if [ "$SEED_DATA" = true ]; then
    print_status "Seeding moderation test data..."
    if npx tsx scripts/seed-moderation-test-users.ts; then
        print_success "Test data seeded successfully"
        echo ""
    else
        print_error "Failed to seed test data"
        exit 1
    fi
fi

# Run integration tests
if [ "$RUN_INTEGRATION" = true ]; then
    print_status "Running integration tests..."
    echo ""
    
    INTEGRATION_FAILED=false
    
    # Ban API tests
    print_status "Testing ban/unban API..."
    if [ "$VERBOSE" = true ]; then
        npm run test:integration tests/integration/moderation-ban-api.test.ts -- --reporter=verbose || INTEGRATION_FAILED=true
    else
        npm run test:integration tests/integration/moderation-ban-api.test.ts || INTEGRATION_FAILED=true
    fi
    
    if [ "$INTEGRATION_FAILED" = false ]; then
        print_success "Ban/unban API tests passed"
    fi
    echo ""
    
    # Actions API tests
    print_status "Testing block/mute/report API..."
    if [ "$VERBOSE" = true ]; then
        npm run test:integration tests/integration/moderation-actions-api.test.ts -- --reporter=verbose || INTEGRATION_FAILED=true
    else
        npm run test:integration tests/integration/moderation-actions-api.test.ts || INTEGRATION_FAILED=true
    fi
    
    if [ "$INTEGRATION_FAILED" = false ]; then
        print_success "Block/mute/report API tests passed"
    fi
    echo ""
    
    # Sorting tests
    print_status "Testing user sorting by moderation metrics..."
    if [ "$VERBOSE" = true ]; then
        npm run test:integration tests/integration/moderation-sorting.test.ts -- --reporter=verbose || INTEGRATION_FAILED=true
    else
        npm run test:integration tests/integration/moderation-sorting.test.ts || INTEGRATION_FAILED=true
    fi
    
    if [ "$INTEGRATION_FAILED" = false ]; then
        print_success "User sorting tests passed"
    fi
    echo ""
    
    if [ "$INTEGRATION_FAILED" = true ]; then
        print_error "Some integration tests failed"
        exit 1
    else
        print_success "All integration tests passed! ✨"
        echo ""
    fi
fi

# Run E2E tests
if [ "$RUN_E2E" = true ]; then
    print_status "Running E2E tests..."
    print_warning "Note: E2E tests require the dev server to be running"
    echo ""
    
    E2E_FAILED=false
    
    # Comprehensive moderation tests
    print_status "Testing complete moderation flows..."
    if [ "$VERBOSE" = true ]; then
        npm run test:e2e tests/e2e/moderation-complete.spec.ts -- --reporter=verbose || E2E_FAILED=true
    else
        npm run test:e2e tests/e2e/moderation-complete.spec.ts || E2E_FAILED=true
    fi
    
    if [ "$E2E_FAILED" = false ]; then
        print_success "E2E moderation tests passed"
    fi
    echo ""
    
    if [ "$E2E_FAILED" = true ]; then
        print_error "Some E2E tests failed"
        exit 1
    else
        print_success "All E2E tests passed! ✨"
        echo ""
    fi
fi

# Summary
echo "================================="
echo ""
print_success "Moderation test suite completed!"
echo ""
echo "Test Summary:"
if [ "$RUN_INTEGRATION" = true ]; then
    echo "  ✅ Integration Tests: PASSED"
fi
if [ "$RUN_E2E" = true ]; then
    echo "  ✅ E2E Tests: PASSED"
fi
echo ""
echo "📚 For more information, see tests/MODERATION_TESTS_GUIDE.md"
echo ""

