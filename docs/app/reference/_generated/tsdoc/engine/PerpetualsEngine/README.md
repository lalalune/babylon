[**babylon v0.1.0**](../../README.md)

***

[babylon](../../README.md) / engine/PerpetualsEngine

# engine/PerpetualsEngine

Perpetuals Trading Engine

## Description

Manages perpetual futures contracts trading system for Babylon. Handles position
lifecycle, funding rate calculations, liquidations, PnL tracking, and market data.

**Core Functionality:**
- Open/close leveraged long/short positions
- Calculate funding payments every 8 hours
- Monitor and execute liquidations
- Track unrealized and realized PnL
- Record daily price snapshots
- Sync position state to database

**Key Concepts:**

**Perpetual Futures:**
- Derivative contracts with no expiry date
- Track underlying company stock prices
- Leverage: 1-100x (configurable per market)
- Two sides: Long (bet price up) or Short (bet price down)

**Funding Rates:**
- Periodic payments between longs and shorts (every 8 hours)
- Keeps perpetual price aligned with spot price
- Longs pay shorts when funding positive
- Shorts pay longs when funding negative

**Liquidations:**
- Triggered when position reaches liquidation price
- Trader loses entire margin (collateral)
- Position automatically closed
- Liquidation price depends on leverage and side

**Position Sizing:**
- Size measured in USD notional value
- Margin = Size / Leverage
- Example: $1000 position at 10x = $100 margin

**Database Sync:**
- Periodic sync of dirty positions (every 10 seconds)
- Tracks which positions changed since last sync
- Batch updates for efficiency
- Final sync on engine stop

**Events Emitted:**
- `position:opened` - New position created
- `position:closed` - Position closed manually
- `position:liquidated` - Position liquidated
- `funding:processed` - Funding payments processed
- `funding:rate:updated` - Funding rate updated
- `market:updated` - Market price updated
- `daily:snapshot` - Daily snapshot recorded

## See

 - /shared/perps-types.ts - Core perpetuals types and calculations
 - TradeExecutionService - Executes NPC perp trades
 - GameEngine - Uses PerpetualsEngine for price updates

## Example

```typescript
const perps = new PerpetualsEngine();

// Initialize markets
perps.initializeMarkets(organizations);

// Open position
const position = perps.openPosition('user-1', {
  ticker: 'TECH',
  side: 'long',
  size: 1000,
  leverage: 10,
  orderType: 'market'
});

// Update prices
perps.updatePositions(new Map([['org-tech', 105]]));

// Process funding
perps.processFunding();

// Close position
const { realizedPnL } = perps.closePosition(position.id);
```

## Classes

- [PerpetualsEngine](classes/PerpetualsEngine.md)
