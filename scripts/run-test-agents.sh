#!/bin/bash

# Run Test Agents Multiple Times
# Generates multiple windows of training data

set -e

AGENTS=${1:-5}
DURATION=${2:-5}
RUNS=${3:-3}

echo "============================================================"
echo "GENERATING RL TRAINING DATA"
echo "============================================================"
echo "Agents per run: $AGENTS"
echo "Duration per run: $DURATION minutes"
echo "Total runs: $RUNS"
echo "============================================================"
echo ""

for i in $(seq 1 $RUNS); do
  echo "Run $i/$RUNS:"
  npx ts-node scripts/spawn-test-agents.ts --agents=$AGENTS --duration=$DURATION
  echo ""
  
  # Wait a bit between runs
  if [ $i -lt $RUNS ]; then
    echo "Waiting 10 seconds before next run..."
    sleep 10
  fi
done

echo ""
echo "============================================================"
echo "DATA GENERATION COMPLETE"
echo "============================================================"
echo "Generated $RUNS windows with $AGENTS agents each"
echo ""
echo "Next steps:"
echo "  1. cd python"
echo "  2. python scripts/check_windows.py"
echo "  3. python scripts/train_mmo.py --min-agents $AGENTS"
echo ""



