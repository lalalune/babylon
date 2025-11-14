#!/bin/bash

# Start Development Server Optimized for Load Testing
#
# This script starts the Next.js server with database connection pool
# settings optimized for handling thousands of concurrent users.

echo "Starting server with optimized connection pool..."
echo "Connection limit: 50"
echo "Pool timeout: 30s"
echo ""

# Set optimized DATABASE_URL with connection pooling
export DATABASE_URL="postgresql://babylon:babylon_dev_password@localhost:5433/babylon?connection_limit=50&pool_timeout=30&connect_timeout=10&statement_timeout=30000"

# Enable query monitoring
export ENABLE_QUERY_MONITORING="true"
export SLOW_QUERY_THRESHOLD_MS="100"

# Start Next.js
bun run dev:next-only

