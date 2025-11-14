# 🧪 Test Mode Usage Guide

The agent now supports a comprehensive test mode for running a fixed number of ticks with full logging!

## Quick Start

```bash
# Run for 10 ticks (test mode)
uv run python agent_http.py --test

# Run for 5 ticks with logging
uv run python agent_http.py --ticks 5 --log test.jsonl

# Run for 3 ticks with fast intervals
TICK_INTERVAL=5 uv run python agent_http.py --ticks 3 --log test.jsonl
```

---

## Command-Line Options

### `--test`
**Quick test mode: Run for 10 ticks and exit**

```bash
uv run python agent_http.py --test
```

- Runs exactly 10 ticks
- Uses default tick interval (30s from `.env`)
- No log file created (console only)
- Perfect for quick validation

### `--ticks N`
**Run for N ticks and exit**

```bash
uv run python agent_http.py --ticks 5
```

- Runs exactly N ticks
- Uses default tick interval
- No log file created (console only)
- Good for custom test lengths

### `--log FILE`
**Save logs to file (JSONL format)**

```bash
uv run python agent_http.py --ticks 10 --log my_test.jsonl
```

- Logs all events to `FILE` in JSONL format
- Creates `FILE_summary.json` with statistics
- Works with both `--test` and `--ticks`
- Perfect for debugging and analysis

---

## Example Usage

### 1. Quick Test (10 ticks, no logging)
```bash
uv run python agent_http.py --test
```

**Output:**
```
🤖 Starting Babylon Autonomous Agent...
🧪 TEST MODE: Running for 10 ticks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Phase 1: Agent Identity Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Agent Identity Ready
   Token ID: 12345
   Address: 0x7099...79C8

🔄 TICK #1 / 10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Tick #1 complete
   Duration: 0.99s

[... 9 more ticks ...]

🎉 TEST COMPLETE
Total ticks: 10
Total duration: 305.23s
Avg tick duration: 30.52s
```

### 2. Test with Logging
```bash
uv run python agent_http.py --ticks 5 --log test.jsonl
```

**Creates:**
- `test.jsonl` - All events in JSONL format (28 lines)
- `test_summary.json` - Statistics and full log

### 3. Fast Test with Logging
```bash
TICK_INTERVAL=5 uv run python agent_http.py --ticks 3 --log fast_test.jsonl
```

**Perfect for:**
- Quick iteration during development
- Testing changes without waiting
- Collecting logs for analysis

---

## Logging Details

### Console Output

Enhanced console logging with timestamps and emoji indicators:

```
📝 [2025-11-12T22:54:31.462870] Starting Babylon Autonomous Agent
✅ [2025-11-12T22:54:31.470312] Agent Identity Ready
   Data: {"tokenId": 16871, "address": "0x7099...", ...}
🔍 [2025-11-12T22:54:31.597557] Memory: 0 actions stored
✅ [2025-11-12T22:54:32.591703] Tick #1 complete
   Data: {"duration_seconds": 0.99, "decision_preview": "..."}
```

**Log Levels:**
- 📝 `INFO` - General information
- ✅ `SUCCESS` - Successful operations
- ❌ `ERROR` - Errors and failures
- ⚠️ `WARNING` - Warnings
- 🔍 `DEBUG` - Debug information

### JSONL Log File

Each line is a JSON object with full event details:

```json
{"timestamp": "2025-11-12T22:54:31.462870", "level": "INFO", "message": "Starting agent", "data": null}
{"timestamp": "2025-11-12T22:54:31.470312", "level": "SUCCESS", "message": "Agent Identity Ready", "data": {"tokenId": 16871, ...}}
{"timestamp": "2025-11-12T22:54:32.591703", "level": "SUCCESS", "message": "Tick #1 complete", "data": {"duration_seconds": 0.99, ...}}
```

**Fields:**
- `timestamp` - ISO 8601 timestamp
- `level` - Log level (INFO, SUCCESS, ERROR, WARNING, DEBUG)
- `message` - Human-readable message
- `data` - Optional structured data (dict or null)

### Summary JSON File

Comprehensive test run statistics:

```json
{
  "total_logs": 28,
  "by_level": {
    "INFO": 15,
    "SUCCESS": 12,
    "ERROR": 0,
    "WARNING": 1,
    "DEBUG": 0
  },
  "logs": [...]
}
```

---

## What Gets Logged

### Phase 1: Agent Identity
- ✅ Private key loading
- ✅ Ethereum address derivation
- ✅ Agent identity creation
- ✅ Token ID and Agent ID

### Phase 2: Babylon A2A Connection
- ✅ A2A endpoint URL
- ✅ Connection establishment
- ✅ Agent ID assignment

### Phase 3: LangGraph Initialization
- ✅ Strategy selection
- ✅ Model configuration
- ✅ Tool loading

### Phase 4: Autonomous Loop
- ✅ Tick start/complete
- ✅ Memory state
- ✅ Decision making
- ✅ Duration tracking
- ✅ Error handling

### Test Complete Summary
- ✅ Total ticks executed
- ✅ Total duration
- ✅ Average tick duration
- ✅ Actions in memory
- ✅ Log file locations

---

## Analyzing Logs

### Count Events by Level
```bash
jq -r '.level' test.jsonl | sort | uniq -c
```

**Output:**
```
  15 INFO
  12 SUCCESS
   1 WARNING
```

### Extract All Decisions
```bash
jq -r 'select(.message | contains("complete")) | .data.decision_preview' test.jsonl
```

### Calculate Average Tick Duration
```bash
jq -r 'select(.data.duration_seconds != null) | .data.duration_seconds' test.jsonl | \
  awk '{sum+=$1; n++} END {print sum/n}'
```

### View Summary Statistics
```bash
jq '.by_level' test_summary.json
```

---

## Environment Variables

Control test behavior via environment:

```bash
# Fast testing (5 second intervals)
TICK_INTERVAL=5 uv run python agent_http.py --ticks 10

# Different strategy
AGENT_STRATEGY=aggressive uv run python agent_http.py --test

# Custom agent name
AGENT_NAME="Test Agent" uv run python agent_http.py --ticks 5
```

---

## Use Cases

### 1. Development Testing
```bash
# Quick validation after code changes
uv run python agent_http.py --test
```

### 2. Performance Profiling
```bash
# Run with logging, analyze timing
TICK_INTERVAL=10 uv run python agent_http.py --ticks 20 --log perf.jsonl
jq -r '.data.duration_seconds // empty' perf.jsonl | \
  awk '{sum+=$1; n++; if(NR==1 || $1<min) min=$1; if(NR==1 || $1>max) max=$1} \
       END {print "Avg:", sum/n, "Min:", min, "Max:", max}'
```

### 3. Error Testing
```bash
# Run and check for errors
uv run python agent_http.py --ticks 10 --log errors.jsonl
jq 'select(.level=="ERROR")' errors.jsonl
```

### 4. Strategy Comparison
```bash
# Test different strategies
for strategy in balanced aggressive conservative; do
  AGENT_STRATEGY=$strategy uv run python agent_http.py --ticks 5 --log ${strategy}.jsonl
done
```

### 5. CI/CD Integration
```bash
#!/bin/bash
# Run test and check for errors
uv run python agent_http.py --ticks 5 --log ci_test.jsonl
errors=$(jq -r 'select(.level=="ERROR") | .message' ci_test.jsonl | wc -l)
if [ $errors -gt 0 ]; then
  echo "❌ Test failed with $errors errors"
  exit 1
else
  echo "✅ Test passed"
fi
```

---

## Comparison: Test Mode vs Production

| Feature | Test Mode | Production |
|---------|-----------|------------|
| **Ticks** | Fixed (N ticks) | Infinite |
| **Exit** | Auto-exit after N ticks | Manual (Ctrl+C) |
| **Logging** | Enhanced with timestamps | Same |
| **Summary** | Generated at end | N/A |
| **Purpose** | Testing, debugging | Live trading |

---

## Tips

### Fast Iteration
```bash
# Quick 3-tick test with 5s intervals
alias quick-test='TICK_INTERVAL=5 uv run python agent_http.py --ticks 3'
quick-test
```

### Log Everything
```bash
# Run with full logging
uv run python agent_http.py --test --log full_test.jsonl 2>&1 | tee console.log
```

### Monitor Progress
```bash
# Watch log file in real-time
uv run python agent_http.py --ticks 10 --log test.jsonl &
tail -f test.jsonl | jq -r '.message'
```

---

## Troubleshooting

### No logs created
- Check write permissions in current directory
- Verify `--log` parameter is provided
- Look for error messages in console

### Test hangs
- Check Babylon server is running
- Verify network connectivity
- Review console for error messages
- Use Ctrl+C to interrupt

### Incomplete test
- Check for errors in console
- Review `ERROR` level logs in JSONL
- Verify environment variables are set

---

## Next Steps

After successful test runs:

1. **Review logs** - Check `test_summary.json` for statistics
2. **Analyze decisions** - Extract decision patterns from logs
3. **Tune parameters** - Adjust strategy, intervals based on results
4. **Run production** - Remove `--test`/`--ticks` for live trading

```bash
# After testing, run production
uv run python agent_http.py
```

---

**Happy testing! 🧪🤖**

