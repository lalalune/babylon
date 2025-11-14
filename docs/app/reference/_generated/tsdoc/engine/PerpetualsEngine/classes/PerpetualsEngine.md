[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/PerpetualsEngine](../README.md) / PerpetualsEngine

# Class: PerpetualsEngine

Defined in: [src/engine/PerpetualsEngine.ts:193](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L193)

Perpetuals Trading Engine

 PerpetualsEngine

## Description

Complete perpetual futures trading system with position management, funding
rates, liquidation engine, and database persistence. Handles all aspects of
leveraged trading for both players and NPCs.

**State Management:**
- In-memory state for fast operations
- Periodic database sync (every 10 seconds)
- Dirty tracking for efficient updates
- Hydration from database on startup

**Position Lifecycle:**
1. Open: Create position with entry price and leverage
2. Update: Price changes update unrealized PnL
3. Funding: Periodic payments every 8 hours
4. Close/Liquidate: Realize PnL and settle position

**Risk Management:**
- Automatic liquidation monitoring on price updates
- Liquidation price calculated on open
- Margin loss on liquidation (full collateral)
- Position limits via min order size

**Market Data:**
- Current price, 24h change, high/low
- Volume and open interest tracking
- Funding rate and next funding time
- Mark price vs index price

## Usage

Instantiated once by GameEngine and persists for entire game lifecycle.

## Extends

- `EventEmitter`

## Constructors

### Constructor

> **new PerpetualsEngine**(): `PerpetualsEngine`

Defined in: [src/engine/PerpetualsEngine.ts:226](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L226)

Create a new PerpetualsEngine

#### Returns

`PerpetualsEngine`

#### Description

Initializes the engine and starts periodic database synchronization.

**Automatic Processes:**
- Starts 10-second sync timer for position updates
- Initializes all state maps
- Sets up event emitter

#### Example

```typescript
const perps = new PerpetualsEngine();
perps.on('position:liquidated', (liq) => {
  console.log(`Liquidation: ${liq.ticker} at $${liq.actualPrice}`);
});
```

#### Overrides

`EventEmitter.constructor`

## Methods

### initializeMarkets()

> **initializeMarkets**(`organizations`): `void`

Defined in: [src/engine/PerpetualsEngine.ts:269](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L269)

Initialize perpetual futures markets from organizations

#### Parameters

##### organizations

[`Organization`](../../FeedGenerator/interfaces/Organization.md)[]

Array of organizations (filters to companies with prices)

#### Returns

`void`

#### Description

Creates perpetual futures markets for all companies with initial prices.
Sets up market data, funding rates, and initial state.

**Market Initialization:**
- Filters to organizations with type='company' and initialPrice
- Generates ticker symbols (max 12 chars, uppercase, no dashes)
- Sets current price from organization's current or initial price
- Initializes 24h stats (change, high, low, volume)
- Sets default funding rate (1% annual)
- Configures max leverage (100x) and min order size

**Funding Schedule:**
- Every 8 hours: 00:00, 08:00, 16:00 UTC
- Next funding time calculated and set

#### Usage

Called once by GameEngine during initialization.

#### Example

```typescript
const orgs = [
  { id: 'tech-corp', type: 'company', initialPrice: 100, ... },
  { id: 'mega-inc', type: 'company', currentPrice: 250, ... }
];

perps.initializeMarkets(orgs);
// Creates markets: TECHCORP, MEGAINC

const markets = perps.getMarkets();
console.log(`Initialized ${markets.length} markets`);
```

***

### openPosition()

> **openPosition**(`userId`, `order`): `PerpPosition`

Defined in: [src/engine/PerpetualsEngine.ts:314](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L314)

Open a new position

#### Parameters

##### userId

`string`

##### order

`OrderRequest`

#### Returns

`PerpPosition`

***

### closePosition()

> **closePosition**(`positionId`, `exitPriceOverride?`): `object`

Defined in: [src/engine/PerpetualsEngine.ts:379](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L379)

Close a position

#### Parameters

##### positionId

`string`

##### exitPriceOverride?

`number`

#### Returns

`object`

##### position

> **position**: `PerpPosition`

##### realizedPnL

> **realizedPnL**: `number`

***

### updatePositions()

> **updatePositions**(`priceUpdates`): `void`

Defined in: [src/engine/PerpetualsEngine.ts:458](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L458)

Update all positions with new prices
Marks positions as dirty for periodic database sync

#### Parameters

##### priceUpdates

`PriceUpdateMap`

#### Returns

`void`

***

### hydrateOpenPositions()

> **hydrateOpenPositions**(`positions`): `void`

Defined in: [src/engine/PerpetualsEngine.ts:516](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L516)

Hydrate engine state with existing open positions from database

#### Parameters

##### positions

`HydratablePerpPosition`[]

#### Returns

`void`

***

### hydratePosition()

> **hydratePosition**(`position`): `void`

Defined in: [src/engine/PerpetualsEngine.ts:560](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L560)

#### Parameters

##### position

`HydratablePerpPosition`

#### Returns

`void`

***

### processFunding()

> **processFunding**(): `void`

Defined in: [src/engine/PerpetualsEngine.ts:568](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L568)

Process funding payments (called every 8 hours)
Should be called at 00:00, 08:00, and 16:00 UTC

#### Returns

`void`

***

### recordDailySnapshot()

> **recordDailySnapshot**(`date?`): `void`

Defined in: [src/engine/PerpetualsEngine.ts:696](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L696)

Record end-of-day price snapshot

#### Parameters

##### date?

`string`

#### Returns

`void`

***

### getDailySnapshots()

> **getDailySnapshots**(`ticker`, `days`): `DailyPriceSnapshot`[]

Defined in: [src/engine/PerpetualsEngine.ts:734](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L734)

Get daily snapshot for a ticker

#### Parameters

##### ticker

`string`

##### days

`number` = `30`

#### Returns

`DailyPriceSnapshot`[]

***

### getMarkets()

> **getMarkets**(): `PerpMarket`[]

Defined in: [src/engine/PerpetualsEngine.ts:742](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L742)

Get all markets

#### Returns

`PerpMarket`[]

***

### getUserPositions()

> **getUserPositions**(`userId`): `PerpPosition`[]

Defined in: [src/engine/PerpetualsEngine.ts:749](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L749)

Get user positions

#### Parameters

##### userId

`string`

#### Returns

`PerpPosition`[]

***

### getPosition()

> **getPosition**(`positionId`): `PerpPosition` \| `undefined`

Defined in: [src/engine/PerpetualsEngine.ts:755](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L755)

#### Parameters

##### positionId

`string`

#### Returns

`PerpPosition` \| `undefined`

***

### hasPosition()

> **hasPosition**(`positionId`): `boolean`

Defined in: [src/engine/PerpetualsEngine.ts:759](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L759)

#### Parameters

##### positionId

`string`

#### Returns

`boolean`

***

### getTradingStats()

> **getTradingStats**(`userId`): `TradingStats`

Defined in: [src/engine/PerpetualsEngine.ts:766](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L766)

Get trading stats

#### Parameters

##### userId

`string`

#### Returns

`TradingStats`

***

### syncDirtyPositions()

> **syncDirtyPositions**(): `Promise`\<`void`\>

Defined in: [src/engine/PerpetualsEngine.ts:864](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L864)

Sync dirty positions to database

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `void`

Defined in: [src/engine/PerpetualsEngine.ts:910](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L910)

Stop periodic sync (cleanup)

#### Returns

`void`

***

### exportState()

> **exportState**(): `object`

Defined in: [src/engine/PerpetualsEngine.ts:962](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L962)

Save state to JSON

#### Returns

`object`

##### positions

> **positions**: `PerpPosition`[]

##### markets

> **markets**: `PerpMarket`[]

##### fundingRates

> **fundingRates**: `FundingRate`[]

##### dailySnapshots

> **dailySnapshots**: `object`

###### Index Signature

\[`k`: `string`\]: `DailyPriceSnapshot`[]

##### liquidations

> **liquidations**: `Liquidation`[]

##### lastFundingTime

> **lastFundingTime**: `string`

##### currentDate

> **currentDate**: `string`

***

### importState()

> **importState**(`state`): `void`

Defined in: [src/engine/PerpetualsEngine.ts:977](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/PerpetualsEngine.ts#L977)

Load state from JSON

#### Parameters

##### state

###### positions

`PerpPosition`[]

###### markets

`PerpMarket`[]

###### fundingRates

`FundingRate`[]

###### dailySnapshots

`Record`\<`string`, `DailyPriceSnapshot`[]\>

###### liquidations

`Liquidation`[]

###### lastFundingTime

`string` \| `number`

###### currentDate

`string`

#### Returns

`void`
