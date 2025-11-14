# Benchmark Testing for Autonomous Babylon Agent

Run this agent through standardized benchmarks to measure performance.

## Quick Start

```bash
# 1. Build main project (needed for benchmark modules)
cd ../..
npm run build
cd examples/autonomous-babylon-agent

# 2. Run a benchmark
bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --runs=5 \
  --output=./benchmark-results/my-test
```

## Prerequisites

1. **Build Main Project**
   ```bash
   cd ../..
   npm run build
   cd examples/autonomous-babylon-agent
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Required:
   - `GROQ_API_KEY` (or `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)
   - `AGENT0_PRIVATE_KEY`
   - `AGENT_STRATEGY` (aggressive, conservative, balanced)

3. **Install Dependencies**
   ```bash
   bun install
   ```

## Running Benchmarks

### Single Run

```bash
bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/single
```

### Multiple Runs

```bash
bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --runs=10 \
  --output=./benchmark-results/multi
```

### Test Different Strategies

```bash
# Aggressive
AGENT_STRATEGY=aggressive bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/aggressive

# Conservative
AGENT_STRATEGY=conservative bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/conservative

# Balanced
AGENT_STRATEGY=balanced bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/balanced
```

## Generating Benchmarks

If you need to create a new benchmark:

```bash
cd ../..
npx ts-node scripts/generate-benchmark.ts \
  --duration=15 \
  --interval=60 \
  --markets=8 \
  --perpetuals=5 \
  --seed=12345
```

This creates `benchmarks/benchmark-{id}.json` which you can then use.

## Understanding Results

Results are saved to the output directory:

```
benchmark-results/
└── my-test/
    ├── result.json       # Full results
    ├── metrics.json      # Performance metrics
    ├── index.html        # Visual report (open in browser)
    ├── summary.html
    ├── detailed.html
    └── timeline.html
```

### Key Metrics

- **Total P&L**: Net profit/loss from all positions
- **Prediction Accuracy**: % of correct market predictions
- **Perp Win Rate**: % of profitable perpetual trades
- **Optimality Score**: How close to perfect play (0-100%)
- **Response Time**: Average time per decision

### Viewing Results

```bash
# Open HTML report
open benchmark-results/my-test/index.html

# Or view JSON
cat benchmark-results/my-test/metrics.json | jq
```

## Comparing with Other Agents

To compare against Eliza or LangGraph agents:

1. **Use Same Benchmark**
   ```bash
   BENCHMARK="../../benchmarks/standard-test.json"
   ```

2. **Run This Agent**
   ```bash
   bun run benchmark \
     --benchmark=$BENCHMARK \
     --runs=5 \
     --output=results/autonomous
   ```

3. **Run Other Agents**
   ```bash
   # Eliza
   cd ../..
   npx ts-node scripts/run-eliza-benchmark.ts \
     --agent-id=your-agent \
     --benchmark=benchmarks/standard-test.json \
     --runs=5 \
     --output=results/eliza
   
   # LangGraph
   cd examples/babylon-langgraph-agent
   python benchmark_runner.py \
     --benchmark=../../benchmarks/standard-test.json \
     --runs=5 \
     --output=results/langgraph
   ```

4. **Compare Results**
   ```bash
   # Compare P&L
   jq '.comparison.avgPnl' results/autonomous/comparison.json
   jq '.comparison.avgPnl' ../../results/eliza/comparison.json
   
   # Compare accuracy
   jq '.comparison.avgAccuracy' results/autonomous/comparison.json
   ```

## Troubleshooting

### "Cannot find benchmark modules"

Build the main project:
```bash
cd ../..
npm run build
cd examples/autonomous-babylon-agent
```

### "LLM provider not available"

Check your `.env.local` file has valid API keys:
```bash
cat .env.local | grep API_KEY
```

Try a different provider:
```bash
GROQ_API_KEY=your_key bun run benchmark ...
```

### "Benchmark file not found"

Generate a benchmark first:
```bash
cd ../..
npx ts-node scripts/generate-benchmark.ts --duration=10
```

## Advanced Usage

### Custom Tick Intervals

Simulate different game speeds:

```bash
# Fast ticks (every 30 seconds)
bun run benchmark \
  --benchmark=../../benchmarks/fast.json \
  --tick-interval=30000

# Slow ticks (every 5 minutes)
bun run benchmark \
  --benchmark=../../benchmarks/slow.json \
  --tick-interval=300000
```

### Batch Testing

Test multiple benchmarks:

```bash
#!/bin/bash
for bench in ../../benchmarks/*.json; do
  name=$(basename $bench .json)
  bun run benchmark \
    --benchmark=$bench \
    --output=results/$name
done
```

### Track Over Time

Save results with timestamps:

```bash
bun run benchmark \
  --benchmark=../../benchmarks/standard.json \
  --output=results/$(date +%Y%m%d-%H%M%S)
```

## Next Steps

1. Run baseline benchmark
2. Make strategy changes
3. Re-run benchmark
4. Compare results
5. Iterate!

See [BENCHMARK_COMPARISON_GUIDE.md](../../docs/BENCHMARK_COMPARISON_GUIDE.md) for complete details.




Run this agent through standardized benchmarks to measure performance.

## Quick Start

```bash
# 1. Build main project (needed for benchmark modules)
cd ../..
npm run build
cd examples/autonomous-babylon-agent

# 2. Run a benchmark
bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --runs=5 \
  --output=./benchmark-results/my-test
```

## Prerequisites

1. **Build Main Project**
   ```bash
   cd ../..
   npm run build
   cd examples/autonomous-babylon-agent
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Required:
   - `GROQ_API_KEY` (or `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)
   - `AGENT0_PRIVATE_KEY`
   - `AGENT_STRATEGY` (aggressive, conservative, balanced)

3. **Install Dependencies**
   ```bash
   bun install
   ```

## Running Benchmarks

### Single Run

```bash
bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/single
```

### Multiple Runs

```bash
bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --runs=10 \
  --output=./benchmark-results/multi
```

### Test Different Strategies

```bash
# Aggressive
AGENT_STRATEGY=aggressive bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/aggressive

# Conservative
AGENT_STRATEGY=conservative bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/conservative

# Balanced
AGENT_STRATEGY=balanced bun run benchmark \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/balanced
```

## Generating Benchmarks

If you need to create a new benchmark:

```bash
cd ../..
npx ts-node scripts/generate-benchmark.ts \
  --duration=15 \
  --interval=60 \
  --markets=8 \
  --perpetuals=5 \
  --seed=12345
```

This creates `benchmarks/benchmark-{id}.json` which you can then use.

## Understanding Results

Results are saved to the output directory:

```
benchmark-results/
└── my-test/
    ├── result.json       # Full results
    ├── metrics.json      # Performance metrics
    ├── index.html        # Visual report (open in browser)
    ├── summary.html
    ├── detailed.html
    └── timeline.html
```

### Key Metrics

- **Total P&L**: Net profit/loss from all positions
- **Prediction Accuracy**: % of correct market predictions
- **Perp Win Rate**: % of profitable perpetual trades
- **Optimality Score**: How close to perfect play (0-100%)
- **Response Time**: Average time per decision

### Viewing Results

```bash
# Open HTML report
open benchmark-results/my-test/index.html

# Or view JSON
cat benchmark-results/my-test/metrics.json | jq
```

## Comparing with Other Agents

To compare against Eliza or LangGraph agents:

1. **Use Same Benchmark**
   ```bash
   BENCHMARK="../../benchmarks/standard-test.json"
   ```

2. **Run This Agent**
   ```bash
   bun run benchmark \
     --benchmark=$BENCHMARK \
     --runs=5 \
     --output=results/autonomous
   ```

3. **Run Other Agents**
   ```bash
   # Eliza
   cd ../..
   npx ts-node scripts/run-eliza-benchmark.ts \
     --agent-id=your-agent \
     --benchmark=benchmarks/standard-test.json \
     --runs=5 \
     --output=results/eliza
   
   # LangGraph
   cd examples/babylon-langgraph-agent
   python benchmark_runner.py \
     --benchmark=../../benchmarks/standard-test.json \
     --runs=5 \
     --output=results/langgraph
   ```

4. **Compare Results**
   ```bash
   # Compare P&L
   jq '.comparison.avgPnl' results/autonomous/comparison.json
   jq '.comparison.avgPnl' ../../results/eliza/comparison.json
   
   # Compare accuracy
   jq '.comparison.avgAccuracy' results/autonomous/comparison.json
   ```

## Troubleshooting

### "Cannot find benchmark modules"

Build the main project:
```bash
cd ../..
npm run build
cd examples/autonomous-babylon-agent
```

### "LLM provider not available"

Check your `.env.local` file has valid API keys:
```bash
cat .env.local | grep API_KEY
```

Try a different provider:
```bash
GROQ_API_KEY=your_key bun run benchmark ...
```

### "Benchmark file not found"

Generate a benchmark first:
```bash
cd ../..
npx ts-node scripts/generate-benchmark.ts --duration=10
```

## Advanced Usage

### Custom Tick Intervals

Simulate different game speeds:

```bash
# Fast ticks (every 30 seconds)
bun run benchmark \
  --benchmark=../../benchmarks/fast.json \
  --tick-interval=30000

# Slow ticks (every 5 minutes)
bun run benchmark \
  --benchmark=../../benchmarks/slow.json \
  --tick-interval=300000
```

### Batch Testing

Test multiple benchmarks:

```bash
#!/bin/bash
for bench in ../../benchmarks/*.json; do
  name=$(basename $bench .json)
  bun run benchmark \
    --benchmark=$bench \
    --output=results/$name
done
```

### Track Over Time

Save results with timestamps:

```bash
bun run benchmark \
  --benchmark=../../benchmarks/standard.json \
  --output=results/$(date +%Y%m%d-%H%M%S)
```

## Next Steps

1. Run baseline benchmark
2. Make strategy changes
3. Re-run benchmark
4. Compare results
5. Iterate!

See [BENCHMARK_COMPARISON_GUIDE.md](../../docs/BENCHMARK_COMPARISON_GUIDE.md) for complete details.


