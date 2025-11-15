# Markets Architecture

## Overview

Babylon has three distinct market types, each with dedicated components and APIs:

## 1. Prediction Markets (Binary YES/NO)

**Purpose:** Users bet on binary outcomes of questions

**Components:**
- `MarketsPanel.tsx` - Feed/trending sidebar widget
- `PredictionTradingModal.tsx` - Buy YES/NO shares
- `PredictionPositionsList.tsx` - View active positions

**Pricing:** Constant Product AMM
```
yesPrice = yesShares / (yesShares + noShares)
noPrice = noShares / (yesShares + noShares)
```

**APIs:**
- `GET /api/feed/widgets/markets` - Top prediction markets with price changes
- `GET /api/markets/predictions` - All prediction markets
- `POST /api/markets/predictions/{id}/buy` - Buy shares
- `POST /api/markets/predictions/{id}/sell` - Sell shares

**Features:**
- AMM pricing with dynamic odds
- Price change tracking (24h)
- Top movers section (markets with biggest probability shifts)
- Fallback "Most Active" section (by volume when no movers)

---

## 2. Perpetual Futures (Leveraged Trading)

**Purpose:** Long/short trading on company stocks with leverage

**Components:**
- `TopMoversPanel.tsx` - Top gainers/losers widget
- `MarketOverviewPanel.tsx` - Market statistics
- `MarketsWidgetSidebar.tsx` - Combines both for /markets page
- `PerpTradingModal.tsx` - Open long/short positions
- `PerpPositionsList.tsx` - View open positions

**Features:**
- 1-100x leverage
- Funding rates (paid every 8h)
- Automatic liquidations
- Real-time PnL tracking

**APIs:**
- `GET /api/markets/perps` - All perpetual markets
- `POST /api/markets/perps/open` - Open position
- `POST /api/markets/perps/{id}/close` - Close position

---

## 3. Trading Pools (NPC-Managed Funds)

**Purpose:** Users invest in pools managed by NPC traders

**Components:**
- `PoolsList.tsx` - Browse available pools
- `UserPoolPositions.tsx` - View your investments
- `PoolsErrorBoundary.tsx` - Error handling

**Features:**
- NPC-managed trading strategies
- Performance-based fees
- Reputation system
- Multiple tier levels (S, A, B, C)

**APIs:**
- `GET /api/pools` - All pools
- `POST /api/pools/{id}/deposit` - Invest in pool
- `POST /api/pools/{id}/withdraw` - Withdraw from pool
- `GET /api/pools/deposits/{userId}` - User's positions

---

## 4. P&L Sharing (Social Features)

**Purpose:** Share trading performance on social media

**Components:**
- `PortfolioPnLCard.tsx` - Overall portfolio display
- `CategoryPnLCard.tsx` - Per-category (perps/predictions/pools)
- `PortfolioPnLShareModal.tsx` - Share portfolio
- `CategoryPnLShareModal.tsx` - Share category performance
- `PortfolioPnLShareCard.tsx` - Shareable image card
- `CategoryPnLShareCard.tsx` - Category shareable card

**Features:**
- Download 1200x630 PNG cards
- Share to Twitter/X
- Share to Farcaster
- Copy share links
- Reputation tracking

---

## 5. Market Bias Indicator

**Purpose:** Show active market manipulations/biases

**Components:**
- `MarketBiasIndicator.tsx` - Display active biases

**Features:**
- Show sentiment adjustments
- Price impact display
- Decay rates
- Expiration timers

**API:**
- `GET /api/markets/bias/active` - Active market biases

---

## Architecture Principles

### Why This Works Well

1. **Clear Separation:** Each market type has dedicated components
2. **No Code Duplication:** Perps, predictions, and pools are distinct
3. **Proper Abstraction:** Trading modals follow similar patterns but aren't duplicated
4. **Consistent APIs:** RESTful endpoints for each market type
5. **Modular Widgets:** Can be composed into different sidebars

### Component Composition

**Feed/Trending Pages:**
```tsx
<WidgetSidebar>
 <LatestNewsPanel />
 <TrendingPanel />
 <MarketsPanel /> {/* Prediction markets */}
</WidgetSidebar>
```

**Markets Page:**
```tsx
<MarketsWidgetSidebar>
 <MarketOverviewPanel />
 <TopMoversPanel /> {/* Perp futures */}
</MarketsWidgetSidebar>
```

### Data Flow

1. **Widget Components** fetch from APIs
2. **Modal Components** handle user actions (buy/sell/deposit/withdraw)
3. **Position Lists** display user's active positions
4. **Share Components** generate social media cards

---

## Future Considerations

- Consider adding price history tracking for predictions (currently only perps)
- Could add pool performance charts
- May want to consolidate P&L calculation logic
- Consider adding WebSocket for real-time price updates

---

## Files Removed

- `PoolDetailModal.tsx` - Empty/unused file (removed)

## Debug Code Cleaned

- Removed 6 console.log statements from `MarketsPanel.tsx`
- Kept appropriate console.error in `MarketBiasIndicator.tsx`






