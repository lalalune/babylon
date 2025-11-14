#!/bin/bash

# Ensure test server is running before running tests

echo "🔍 Checking if test server is running..."

# Check if server is responding
if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Test server already running at localhost:3000"
    exit 0
fi

echo "⚠️  Test server not running, starting it now..."

# Kill any existing processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start server in background
echo "🚀 Starting development server..."
bun run dev > /tmp/test-server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > /tmp/test-server.pid

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
MAX_WAIT=30
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -s -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "✅ Test server ready at localhost:3000"
        exit 0
    fi
    sleep 1
    WAITED=$((WAITED + 1))
    echo -n "."
done

echo ""
echo "❌ Server failed to start after ${MAX_WAIT} seconds"
echo "📋 Last 20 lines of server log:"
tail -20 /tmp/test-server.log
exit 1

