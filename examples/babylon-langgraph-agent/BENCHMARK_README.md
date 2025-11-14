# Benchmark Testing for Babylon LangGraph Agent

Run this agent through standardized benchmarks to measure performance.

## Quick Start

```bash
# 1. Setup environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e .

# 2. Run a benchmark
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --runs=5 \
  --output=./benchmark-results/my-test
```

## Prerequisites

1. **Python Environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -e .
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Required:
   - `OPENAI_API_KEY` (or other LLM provider key)
   - `BABYLON_API_URL` (for reference, not used in benchmark)

3. **Verify Setup**
   ```bash
   python -c "import agent; print('Agent module loaded successfully')"
   ```

## Running Benchmarks

### Single Run

```bash
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/single
```

### Multiple Runs

```bash
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --runs=10 \
  --output=./benchmark-results/multi
```

### Different Agent Versions

If you have multiple agent implementations:

```bash
# Use agent.py
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --agent=agent \
  --output=./benchmark-results/v1

# Use agent_v2.py
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --agent=agent_v2 \
  --output=./benchmark-results/v2
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
    └── actions.json      # All actions taken
```

### Key Metrics

- **Total P&L**: Net profit/loss from all positions
- **Prediction Accuracy**: % of correct market predictions
- **Perp Win Rate**: % of profitable perpetual trades
- **Actions Breakdown**: Count by type
  - Predictions
  - Perpetuals
  - Posts

### Viewing Results

```bash
# View metrics
cat benchmark-results/my-test/metrics.json | python -m json.tool

# View actions
cat benchmark-results/my-test/result.json | python -m json.tool | less
```

## Comparing with Other Agents

To compare against Eliza or TypeScript agents:

1. **Use Same Benchmark**
   ```bash
   BENCHMARK="../../benchmarks/standard-test.json"
   ```

2. **Run This Agent**
   ```bash
   python benchmark_runner.py \
     --benchmark=$BENCHMARK \
     --runs=5 \
     --output=results/langgraph
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
   
   # Autonomous (TypeScript)
   cd examples/autonomous-babylon-agent
   bun run benchmark \
     --benchmark=../../benchmarks/standard-test.json \
     --runs=5 \
     --output=results/autonomous
   ```

4. **Compare Results**
   ```bash
   # Extract metrics
   python -c "
   import json
   with open('results/langgraph/comparison.json') as f:
       data = json.load(f)
       print(f'Avg P&L: ${data[\"comparison\"][\"avgPnl\"]:.2f}')
       print(f'Avg Accuracy: {data[\"comparison\"][\"avgAccuracy\"]*100:.1f}%')
   "
   ```

## Troubleshooting

### "No module named 'agent'"

Make sure you're in the correct directory and venv is activated:
```bash
source .venv/bin/activate
python -c "import sys; print(sys.path)"
```

### "Import error"

Check your agent module exists:
```bash
ls agent*.py
```

### "Benchmark file not found"

Generate a benchmark first:
```bash
cd ../..
npx ts-node scripts/generate-benchmark.ts --duration=10
```

Or use absolute path:
```bash
python benchmark_runner.py \
  --benchmark=/absolute/path/to/benchmark.json
```

## Advanced Usage

### Custom Agent Logic

Modify `benchmark_runner.py` to integrate your agent's decision-making:

```python
async def make_agent_decision(agent, context, a2a_client):
    # Your agent logic here
    # Call your LangGraph nodes, state management, etc.
    decision = await agent.decide(context)
    
    # Execute via A2A client
    if decision.action == 'buy_prediction':
        await a2a_client.buy_shares(...)
```

### Batch Testing

Test multiple benchmarks:

```bash
#!/bin/bash
for bench in ../../benchmarks/*.json; do
  name=$(basename $bench .json)
  python benchmark_runner.py \
    --benchmark=$bench \
    --output=results/$name
done
```

### Logging

The script logs to console. To save logs:

```bash
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  2>&1 | tee benchmark.log
```

### Performance Profiling

Profile agent performance:

```bash
python -m cProfile -o profile.stats benchmark_runner.py \
  --benchmark=../../benchmarks/test.json

# View stats
python -m pstats profile.stats
```

## Integrating Your Agent

To fully integrate your LangGraph agent with the benchmark system:

1. **Import your agent in benchmark_runner.py**:
   ```python
   from your_agent_module import YourAgent
   ```

2. **Update `make_agent_decision()`**:
   ```python
   async def make_agent_decision(agent, context, a2a_client):
       # Use your agent's decision logic
       result = await agent.process(context)
       
       # Execute action via A2A
       if result.should_trade:
           await a2a_client.buy_shares(...)
   ```

3. **Add any agent-specific metrics**:
   ```python
   def calculate_metrics(actions, snapshot):
       metrics = {
           # Standard metrics
           'totalPnl': ...,
           
           # Your custom metrics
           'customMetric': ...,
       }
       return metrics
   ```

## Next Steps

1. Run baseline benchmark
2. Analyze decision quality
3. Optimize LangGraph flows
4. Re-run benchmark
5. Compare improvements

See [BENCHMARK_COMPARISON_GUIDE.md](../../docs/BENCHMARK_COMPARISON_GUIDE.md) for complete details.




Run this agent through standardized benchmarks to measure performance.

## Quick Start

```bash
# 1. Setup environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e .

# 2. Run a benchmark
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --runs=5 \
  --output=./benchmark-results/my-test
```

## Prerequisites

1. **Python Environment**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -e .
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Required:
   - `OPENAI_API_KEY` (or other LLM provider key)
   - `BABYLON_API_URL` (for reference, not used in benchmark)

3. **Verify Setup**
   ```bash
   python -c "import agent; print('Agent module loaded successfully')"
   ```

## Running Benchmarks

### Single Run

```bash
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --output=./benchmark-results/single
```

### Multiple Runs

```bash
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --runs=10 \
  --output=./benchmark-results/multi
```

### Different Agent Versions

If you have multiple agent implementations:

```bash
# Use agent.py
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --agent=agent \
  --output=./benchmark-results/v1

# Use agent_v2.py
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  --agent=agent_v2 \
  --output=./benchmark-results/v2
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
    └── actions.json      # All actions taken
```

### Key Metrics

- **Total P&L**: Net profit/loss from all positions
- **Prediction Accuracy**: % of correct market predictions
- **Perp Win Rate**: % of profitable perpetual trades
- **Actions Breakdown**: Count by type
  - Predictions
  - Perpetuals
  - Posts

### Viewing Results

```bash
# View metrics
cat benchmark-results/my-test/metrics.json | python -m json.tool

# View actions
cat benchmark-results/my-test/result.json | python -m json.tool | less
```

## Comparing with Other Agents

To compare against Eliza or TypeScript agents:

1. **Use Same Benchmark**
   ```bash
   BENCHMARK="../../benchmarks/standard-test.json"
   ```

2. **Run This Agent**
   ```bash
   python benchmark_runner.py \
     --benchmark=$BENCHMARK \
     --runs=5 \
     --output=results/langgraph
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
   
   # Autonomous (TypeScript)
   cd examples/autonomous-babylon-agent
   bun run benchmark \
     --benchmark=../../benchmarks/standard-test.json \
     --runs=5 \
     --output=results/autonomous
   ```

4. **Compare Results**
   ```bash
   # Extract metrics
   python -c "
   import json
   with open('results/langgraph/comparison.json') as f:
       data = json.load(f)
       print(f'Avg P&L: ${data[\"comparison\"][\"avgPnl\"]:.2f}')
       print(f'Avg Accuracy: {data[\"comparison\"][\"avgAccuracy\"]*100:.1f}%')
   "
   ```

## Troubleshooting

### "No module named 'agent'"

Make sure you're in the correct directory and venv is activated:
```bash
source .venv/bin/activate
python -c "import sys; print(sys.path)"
```

### "Import error"

Check your agent module exists:
```bash
ls agent*.py
```

### "Benchmark file not found"

Generate a benchmark first:
```bash
cd ../..
npx ts-node scripts/generate-benchmark.ts --duration=10
```

Or use absolute path:
```bash
python benchmark_runner.py \
  --benchmark=/absolute/path/to/benchmark.json
```

## Advanced Usage

### Custom Agent Logic

Modify `benchmark_runner.py` to integrate your agent's decision-making:

```python
async def make_agent_decision(agent, context, a2a_client):
    # Your agent logic here
    # Call your LangGraph nodes, state management, etc.
    decision = await agent.decide(context)
    
    # Execute via A2A client
    if decision.action == 'buy_prediction':
        await a2a_client.buy_shares(...)
```

### Batch Testing

Test multiple benchmarks:

```bash
#!/bin/bash
for bench in ../../benchmarks/*.json; do
  name=$(basename $bench .json)
  python benchmark_runner.py \
    --benchmark=$bench \
    --output=results/$name
done
```

### Logging

The script logs to console. To save logs:

```bash
python benchmark_runner.py \
  --benchmark=../../benchmarks/test.json \
  2>&1 | tee benchmark.log
```

### Performance Profiling

Profile agent performance:

```bash
python -m cProfile -o profile.stats benchmark_runner.py \
  --benchmark=../../benchmarks/test.json

# View stats
python -m pstats profile.stats
```

## Integrating Your Agent

To fully integrate your LangGraph agent with the benchmark system:

1. **Import your agent in benchmark_runner.py**:
   ```python
   from your_agent_module import YourAgent
   ```

2. **Update `make_agent_decision()`**:
   ```python
   async def make_agent_decision(agent, context, a2a_client):
       # Use your agent's decision logic
       result = await agent.process(context)
       
       # Execute action via A2A
       if result.should_trade:
           await a2a_client.buy_shares(...)
   ```

3. **Add any agent-specific metrics**:
   ```python
   def calculate_metrics(actions, snapshot):
       metrics = {
           # Standard metrics
           'totalPnl': ...,
           
           # Your custom metrics
           'customMetric': ...,
       }
       return metrics
   ```

## Next Steps

1. Run baseline benchmark
2. Analyze decision quality
3. Optimize LangGraph flows
4. Re-run benchmark
5. Compare improvements

See [BENCHMARK_COMPARISON_GUIDE.md](../../docs/BENCHMARK_COMPARISON_GUIDE.md) for complete details.


