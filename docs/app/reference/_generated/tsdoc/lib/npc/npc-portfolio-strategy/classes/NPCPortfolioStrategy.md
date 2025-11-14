[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/npc/npc-portfolio-strategy](../README.md) / NPCPortfolioStrategy

# Class: NPCPortfolioStrategy

Defined in: [src/lib/npc/npc-portfolio-strategy.ts:50](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-portfolio-strategy.ts#L50)

## Constructors

### Constructor

> **new NPCPortfolioStrategy**(): `NPCPortfolioStrategy`

#### Returns

`NPCPortfolioStrategy`

## Methods

### getStrategy()

> `static` **getStrategy**(`personality`, `marketConditions?`): [`StrategyConfig`](../interfaces/StrategyConfig.md)

Defined in: [src/lib/npc/npc-portfolio-strategy.ts:54](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-portfolio-strategy.ts#L54)

Get strategy configuration based on personality and conditions

#### Parameters

##### personality

`string` | `null`

##### marketConditions?

`MarketConditions`

#### Returns

[`StrategyConfig`](../interfaces/StrategyConfig.md)

***

### calculateOptimalPositionSize()

> `static` **calculateOptimalPositionSize**(`winProbability`, `payoutRatio`, `strategy`): `number`

Defined in: [src/lib/npc/npc-portfolio-strategy.ts:280](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-portfolio-strategy.ts#L280)

Calculate optimal position size using Kelly Criterion

Kelly Criterion: f* = (bp - q) / b
Where:
- f* = optimal fraction of capital to bet
- b = odds received (payout ratio)
- p = probability of winning
- q = probability of losing (1-p)

#### Parameters

##### winProbability

`number`

##### payoutRatio

`number`

##### strategy

[`StrategyConfig`](../interfaces/StrategyConfig.md)

#### Returns

`number`

***

### shouldRebalance()

> `static` **shouldRebalance**(`currentAllocation`, `targetAllocation`, `threshold`): `boolean`

Defined in: [src/lib/npc/npc-portfolio-strategy.ts:307](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-portfolio-strategy.ts#L307)

Determine if rebalancing is needed

#### Parameters

##### currentAllocation

`AssetAllocation`

##### targetAllocation

`AssetAllocation`

##### threshold

`number`

#### Returns

`boolean`

***

### generateRebalancePlan()

> `static` **generateRebalancePlan**(`currentAllocation`, `targetAllocation`, `totalPortfolioValue`): `object`

Defined in: [src/lib/npc/npc-portfolio-strategy.ts:324](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-portfolio-strategy.ts#L324)

Generate rebalancing actions to reach target allocation

#### Parameters

##### currentAllocation

`AssetAllocation`

##### targetAllocation

`AssetAllocation`

##### totalPortfolioValue

`number`

#### Returns

`object`

##### perpAdjustment

> **perpAdjustment**: `number`

##### predictionAdjustment

> **predictionAdjustment**: `number`

##### cashAdjustment

> **cashAdjustment**: `number`

***

### getHoldingPeriodHours()

> `static` **getHoldingPeriodHours**(`period`): `number`

Defined in: [src/lib/npc/npc-portfolio-strategy.ts:347](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-portfolio-strategy.ts#L347)

Get recommended holding period in hours

#### Parameters

##### period

`"long"` | `"short"` | `"medium"`

#### Returns

`number`

***

### evaluateStrategy()

> `static` **evaluateStrategy**(`actualReturns`, `benchmarkReturns`, `riskFreeRate`): `object`

Defined in: [src/lib/npc/npc-portfolio-strategy.ts:360](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-portfolio-strategy.ts#L360)

Evaluate strategy performance metrics

#### Parameters

##### actualReturns

`number`[]

##### benchmarkReturns

`number`[]

##### riskFreeRate

`number` = `0.02`

#### Returns

`object`

##### sharpeRatio

> **sharpeRatio**: `number`

##### maxDrawdown

> **maxDrawdown**: `number`

##### winRate

> **winRate**: `number`

##### alpha

> **alpha**: `number`

##### beta

> **beta**: `number`
