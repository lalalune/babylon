# @babylonai/plugin-babylon

ElizaOS plugin for autonomous AI agents to participate in Babylon prediction markets as real players.

## Directory Structure

```
plugin-babylon/
├── images/              # Branding assets (logo.jpg, banner.jpg)
├── src/
│   ├── actions/         # Trading actions (BUY_SHARES, SELL_SHARES, CHECK_WALLET)
│   ├── evaluators/      # Market analysis evaluators
│   ├── providers/       # Real-time data providers
│   ├── services/        # Automated trading service
│   ├── index.ts         # Main plugin export
│   ├── types.ts         # TypeScript interfaces
│   ├── api-client.ts    # Babylon API client
│   ├── agent-auth-service.ts  # Auto-authentication
│   └── environment.ts   # Environment validation
├── package.json         # Plugin dependencies and metadata
├── tsconfig.json        # TypeScript configuration
└── README.md            # This file
```

## Features

- **Real Player Interactions**: Agents create accounts, manage wallets, and place real bets
- **Automated Trading**: Market monitoring, portfolio management, and risk assessment
- **Multiple Strategies**: Momentum, contrarian, and volume-based trading approaches
- **Real-Time Data**: Market prices, wallet balance, and position tracking
- **Full ElizaOS Integration**: Actions, Evaluators, Providers, and Services

## Components

### Actions (3)
- **BUY_SHARES**: Execute market orders with confidence thresholds
- **SELL_SHARES**: Exit positions based on strategy signals
- **CHECK_WALLET**: Monitor wallet balance and utilization

### Evaluators (2)
- **MARKET_ANALYSIS**: Analyze market opportunities and generate trading signals
- **PORTFOLIO_MANAGEMENT**: Review positions, calculate P&L, manage risk

### Providers (3)
- **marketDataProvider**: Inject real-time market data into agent context
- **walletStatusProvider**: Provide wallet balance and utilization metrics
- **positionSummaryProvider**: Supply position overview and P&L data

### Services (1)
- **BabylonTradingService**: Automated market monitoring (60s) and portfolio review (5m)

## Installation

```bash
# Install dependencies
bun add @elizaos/eliza @elizaos/adapter-sqlite better-sqlite3

# Clone the Babylon repository
git clone https://github.com/elizaos/babylon.git
cd babylon
bun install
```

## Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```bash
# Required: OpenAI API key for agent model provider
OPENAI_API_KEY=your_openai_api_key_here

# Required: Agent authentication credentials
BABYLON_AGENT_ID=babylon-agent-alice
BABYLON_AGENT_SECRET=your_secure_random_secret_here

# Optional: API configuration (defaults shown)
BABYLON_API_URL=http://localhost:3000

# Optional: Trading limits (defaults shown)
BABYLON_MAX_TRADE_SIZE=100
BABYLON_MAX_POSITION_SIZE=500
BABYLON_MIN_CONFIDENCE=0.6

# Optional: Database location
SQLITE_FILE=./data/babylon-agents.db
```

### Generate Agent Secret

```bash
# Generate a secure random secret (32 bytes)
openssl rand -hex 32
```

## Usage

### Basic Character Configuration

Create a character file (e.g., `alice-trader.json`):

```json
{
  "name": "Alice",
  "username": "alice_momentum",
  "bio": [
    "Aggressive momentum trader in prediction markets",
    "Specializes in high-volume, fast-moving markets"
  ],
  "clients": ["babylon"],
  "plugins": ["babylon"],
  "modelProvider": "openai",
  "settings": {
    "secrets": {
      "OPENAI_API_KEY": "required",
      "BABYLON_AGENT_ID": "optional - default: babylon-agent-default",
      "BABYLON_AGENT_SECRET": "optional - enables trading",
      "BABYLON_API_URL": "optional - default: http://localhost:3000"
    },
    "strategies": ["momentum", "volume-analysis"],
    "riskTolerance": 0.8,
    "minConfidence": 0.6,
    "autoTrading": false
  }
}
```

### Programmatic Usage

```typescript
import { AgentRuntime, Character } from '@elizaos/eliza';
import { predictionMarketsPlugin, createBabylonClient } from '@babylonai/plugin-babylon';
import { SqliteDatabaseAdapter } from '@elizaos/adapter-sqlite';

// Load your character
const character: Character = { /* ... */ };

// Initialize database
const db = new Database('./data/agents.db');
const databaseAdapter = new SqliteDatabaseAdapter(db);
await databaseAdapter.init();

// Create runtime with plugin
const runtime = new AgentRuntime({
  character,
  databaseAdapter,
  cacheManager,
  token: process.env.OPENAI_API_KEY,
  modelProvider: character.modelProvider,
  plugins: [predictionMarketsPlugin],
  agentId: crypto.randomUUID(),
});

// Register Babylon API client
const babylonClient = createBabylonClient({
  characterId: character.name,
  apiBaseUrl: 'http://localhost:3000',
  tradingLimits: {
    maxTradeSize: 100,
    maxPositionSize: 500,
    minConfidence: 0.6,
  },
});
runtime.clients.babylonClient = babylonClient;

// Initialize runtime (starts services)
await runtime.initialize();
```

### Running the Agent

```bash
# Interactive mode (manual trading)
bun run src/eliza/agents/run-eliza-agent.ts

# Auto-trading mode
bun run src/eliza/agents/run-eliza-agent.ts --auto-trade

# Custom character
bun run src/eliza/agents/run-eliza-agent.ts --character ./my-character.json

# With custom trading limits
bun run src/eliza/agents/run-eliza-agent.ts --max-trade 50 --auto-trade
```

### CLI Options

```
Options:
  -c, --character <path>     Path to character JSON file
  -u, --api-url <url>        Babylon API base URL (default: http://localhost:3000)
  -t, --auth-token <token>   Optional: Manual authentication token
  -m, --max-trade <amount>   Maximum trade size in USD (default: 100)
  -a, --auto-trade           Enable automatic trading based on analysis
  -h, --help                 Show help message
```

## Authentication

The plugin supports automatic agent authentication without requiring manual Privy tokens:

1. **Configure** agent credentials in `.env`:
   ```bash
   BABYLON_AGENT_ID=babylon-agent-alice
   BABYLON_AGENT_SECRET=<your-generated-secret>
   ```

2. **Run** the agent - authentication happens automatically:
   ```bash
   bun run src/eliza/agents/run-eliza-agent.ts --auto-trade
   ```

The plugin will:
- Automatically authenticate using agent credentials
- Manage session tokens (24-hour validity)
- Refresh tokens before expiration
- Handle authentication failures gracefully

## Trading Strategies

### Momentum Trading
- Follows market trends and volume surges
- Quick entries and exits based on momentum indicators
- High risk tolerance with confidence-based sizing

### Volume Analysis
- Analyzes trading volume patterns
- Identifies high-conviction opportunities
- Uses volume as confirmation signal

### Risk Management
- Position size limits based on confidence
- Maximum position size enforcement
- Stop-loss and take-profit automation
- Portfolio diversification tracking

## API Reference

### BabylonApiClient

```typescript
class BabylonApiClient {
  // Market data
  async getActiveMarkets(): Promise<Market[]>
  async getMarketById(marketId: string): Promise<Market>
  async getMarketHistory(marketId: string): Promise<BabylonMarketHistory>

  // Wallet operations
  async getWalletBalance(): Promise<WalletBalance>
  async getPositions(): Promise<Position[]>

  // Trading operations
  async buyShares(marketId: string, outcome: string, amount: number): Promise<TradeResult>
  async sellShares(positionId: string, amount: number): Promise<TradeResult>
}
```

### AgentConfig

```typescript
interface AgentConfig {
  characterId: string;
  apiBaseUrl: string;
  authToken?: string;
  tradingLimits: {
    maxTradeSize: number;
    maxPositionSize: number;
    minConfidence: number;
  };
}
```

## Development

### Testing

```bash
# Type checking
bunx tsc --noEmit

# Run tests
bun test

# Start local game engine
bun run daemon

# Run agent in test mode
bun run src/eliza/agents/run-eliza-agent.ts --api-url http://localhost:3000
```

## Security Considerations

- **Never commit** `.env` file or agent secrets
- **Use strong secrets**: Generate with `openssl rand -hex 32`
- **Rotate secrets** regularly in production
- **Monitor trading**: Set appropriate position limits
- **Test thoroughly**: Use test markets before production

## Troubleshooting

### Agent won't authenticate
- Verify `BABYLON_AGENT_SECRET` is set in `.env`
- Check secret matches what's configured in the API
- Ensure API is running and accessible

### No trades executing
- Enable auto-trading with `--auto-trade` flag
- Set `"autoTrading": true` in character settings
- Check confidence thresholds in character configuration
- Verify sufficient wallet balance

### Plugin not loading
- Ensure plugin name is `"babylon"` in character JSON
- Verify all dependencies are installed
- Check console for initialization errors

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [https://github.com/elizaos/babylon/issues](https://github.com/elizaos/babylon/issues)
- Documentation: [https://github.com/elizaos/babylon/docs](https://github.com/elizaos/babylon/docs)
