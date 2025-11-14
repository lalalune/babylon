[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/trade-execution-service](../README.md) / TradeExecutionService

# Class: TradeExecutionService

Defined in: [src/lib/services/trade-execution-service.ts:27](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/trade-execution-service.ts#L27)

## Constructors

### Constructor

> **new TradeExecutionService**(): `TradeExecutionService`

#### Returns

`TradeExecutionService`

## Methods

### executeDecisionBatch()

> **executeDecisionBatch**(`decisions`): `Promise`\<`ExecutionResult`\>

Defined in: [src/lib/services/trade-execution-service.ts:31](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/trade-execution-service.ts#L31)

Execute a batch of trading decisions

#### Parameters

##### decisions

`TradingDecision`[]

#### Returns

`Promise`\<`ExecutionResult`\>

***

### executeSingleDecision()

> **executeSingleDecision**(`decision`): `Promise`\<`ExecutedTrade`\>

Defined in: [src/lib/services/trade-execution-service.ts:105](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/trade-execution-service.ts#L105)

Execute a single trading decision

#### Parameters

##### decision

`TradingDecision`

#### Returns

`Promise`\<`ExecutedTrade`\>

***

### getTradeImpacts()

> **getTradeImpacts**(`executedTrades`): `Promise`\<`Map`\<`string`, [`AggregatedImpact`](../../market-impact-service/interfaces/AggregatedImpact.md)\>\>

Defined in: [src/lib/services/trade-execution-service.ts:596](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/trade-execution-service.ts#L596)

Get total trade impact by ticker/market

#### Parameters

##### executedTrades

`ExecutedTrade`[]

#### Returns

`Promise`\<`Map`\<`string`, [`AggregatedImpact`](../../market-impact-service/interfaces/AggregatedImpact.md)\>\>
