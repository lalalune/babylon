# Babylon ElizaOS Agents

AI agents that play Babylon prediction markets as real users using the [ElizaOS](https://github.com/elizaos/eliza) framework.

## Quick Start

### 1. Start the Game Engine

```bash
# Terminal 1: Start Babylon game engine
bun run daemon
```

### 2. Run an Eliza Agent

```bash
# Terminal 2: Run Alice (momentum trader)
bun run eliza:alice

# Or with auto-trading enabled
bun run eliza:auto
```

### 3. (Optional) Provide Authentication

To enable actual trading, provide an auth token:

```bash
bun run eliza --auth-token "your-privy-token" --auto-trade
```

## Project Structure

```
src/eliza/
├── agents/
│   └── run-eliza-agent.ts       # Agent runner script
└── characters/
    └── alice-trader.json        # Character definition

plugin-babylon/                   # Standalone ElizaOS plugin
├── src/
│   ├── actions/                 # Trading actions
│   ├── evaluators/              # Market analysis
│   ├── providers/               # Real-time data
│   ├── services/                # Automation
│   └── index.ts                 # Plugin entry point
└── package.json                 # Plugin metadata
```

## Available Scripts

```bash
# Run default agent (Alice)
bun run eliza

# Run Alice specifically
bun run eliza:alice

# Run with auto-trading
bun run eliza:auto

# Run custom character
bun run eliza --character ./path/to/character.json

# Run with all options
bun run src/eliza/agents/run-eliza-agent.ts \
  --character ./characters/custom.json \
  --auth-token "token" \
  --max-trade 50 \
  --auto-trade
```

## How It Works

### 1. Character Personalities

Each agent has a distinct personality defined in a JSON file:

```json
{
  "name": "Alice",
  "bio": ["Aggressive momentum trader"],
  "strategies": ["momentum", "volume-analysis"],
  "riskTolerance": 0.8,
  "style": {
    "all": ["uses market terminology", "speaks concisely"]
  }
}
```

### 2. Trading Actions

Agents can perform three main actions:

- **BUY_SHARES**: Place bets on prediction markets
- **SELL_SHARES**: Close positions and realize P&L
- **CHECK_WALLET**: View balance and available funds

### 3. Market Analysis

Agents continuously analyze markets using evaluators:

- **Market Analysis**: Evaluates trading opportunities
- **Portfolio Management**: Monitors risk and positions

### 4. Auto-Trading Loop

When auto-trading is enabled:

```
Every 60 seconds:
  → Analyze all active markets
  → Apply character's trading strategy
  → Execute high-confidence trades

Every 5 minutes:
  → Review portfolio performance
  → Check for risk issues
  → Provide recommendations
```

## Creating Custom Characters

### 1. Create Character File

Create `characters/my-trader.json`:

```json
{
  "name": "MyTrader",
  "username": "my_trader",
  "bio": [
    "Your trading personality",
    "Your approach and beliefs"
  ],
  "lore": [
    "Background story",
    "Trading history"
  ],
  "messageExamples": [
    [
      {
        "user": "{{user1}}",
        "content": { "text": "What do you think?" }
      },
      {
        "user": "MyTrader",
        "content": { "text": "Your typical response" }
      }
    ]
  ],
  "topics": [
    "prediction markets",
    "your specialty"
  ],
  "adjectives": [
    "personality",
    "traits"
  ],
  "style": {
    "all": [
      "communication style",
      "language patterns"
    ],
    "chat": ["chat specifics"],
    "post": ["post specifics"]
  },
  "settings": {
    "strategies": ["momentum", "contrarian"],
    "riskTolerance": 0.6,
    "minConfidence": 0.5
  }
}
```

### 2. Run Your Character

```bash
bun run eliza --character characters/my-trader.json
```

## Trading Strategies

### Momentum (Alice)
- Follows strong trends
- High volume + clear direction
- Risk tolerance: 0.8 (high)
- **Example**: "YES at 72% with strong volume → Buy YES"

### Contrarian (Charlie)
- Looks for reversals
- Bets against extreme consensus
- Risk tolerance: 0.6 (medium)
- **Example**: "YES at 85% → Buy NO (contrarian)"

### Fundamental (Bob)
- Conservative analysis
- Balanced markets preferred
- Risk tolerance: 0.3 (low)
- **Example**: "YES at 55% with good liquidity → Small buy"

## Configuration Options

### CLI Arguments

```bash
-c, --character <path>     Character JSON file
-u, --api-url <url>        API base URL (default: http://localhost:3000)
-t, --auth-token <token>   Auth token for trading
-m, --max-trade <amount>   Max trade size (default: 100)
-a, --auto-trade           Enable auto-trading
-h, --help                 Show help
```

### Environment Variables

```bash
OPENAI_API_KEY=your-key      # For OpenAI LLM
GROQ_API_KEY=your-key        # Or Groq as alternative
```

## Examples

### Example 1: Manual Trading

```bash
# Start agent
bun run eliza:alice

# Agent analyzes market when prompted
> "What do you think about market 42?"

# Agent responds with analysis
< "Looking at volume - it's surging. Strong momentum on YES at 68%."

# Manually trigger trade
> "Buy YES for $30"

# Agent executes trade
< "✅ Trade executed! Bought 42.5 shares at avg price $0.71"
```

### Example 2: Auto-Trading

```bash
# Start with auto-trading
bun run eliza:auto

# Agent runs automatically:
📊 [10:15:23] Checking markets...
   Found 2 opportunities:
   📈 Market 42:
      Recommendation: BUY
      Confidence: 82%
      Side: YES
      Reasoning: Strong YES momentum...
   💰 Executing trade...
   ✅ Trade executed! Bought 41 shares

📊 [10:20:23] Portfolio review...
   Total P&L: $125.50
   Win Rate: 65%
   Positions: 4W / 2L
```

## Troubleshooting

### Agent Can't Connect

**Problem**: "Failed to fetch markets"

**Solution**:
```bash
# Ensure game engine is running
bun run daemon

# Check API is accessible
curl http://localhost:3000/api/markets/predictions
```

### No Trades Executing

**Problem**: Agent analyzes but doesn't trade

**Solutions**:
- Provide auth token: `--auth-token "token"`
- Lower confidence threshold in character settings
- Increase risk tolerance
- Ensure markets have sufficient volume

### TypeScript Errors

**Problem**: Build failures

**Solution**:
```bash
# Regenerate Prisma types
bun run prisma:generate

# Check types
bunx tsc --noEmit

# Reinstall dependencies
bun install
```

## Documentation

- **Full Integration Guide**: `docs/ELIZA_INTEGRATION.md`
- **A2A Protocol Guide**: `docs/A2A_INTEGRATION.md`
- **API Reference**: See integration docs for endpoint details

## Next Steps

1. **Test Your Agent**: Run Alice and observe trading behavior
2. **Create Custom Character**: Build your own trading personality
3. **Enable Authentication**: Get Privy token for real trading
4. **Monitor Performance**: Track P&L and win rates
5. **Adjust Strategies**: Tune risk tolerance and confidence thresholds

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review full documentation in `docs/ELIZA_INTEGRATION.md`
3. Inspect agent logs for error details
4. Verify game engine and database are running

---

**Remember**: Agents trade with real (simulated) money. Start with low `maxTradeSize` and monitor behavior before increasing limits!
