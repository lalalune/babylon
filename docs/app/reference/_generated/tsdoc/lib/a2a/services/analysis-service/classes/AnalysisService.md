[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/a2a/services/analysis-service](../README.md) / AnalysisService

# Class: AnalysisService

Defined in: [src/lib/a2a/services/analysis-service.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/services/analysis-service.ts#L12)

## Constructors

### Constructor

> **new AnalysisService**(): `AnalysisService`

#### Returns

`AnalysisService`

## Methods

### storeAnalysis()

> **storeAnalysis**(`marketId`, `analysis`): `string`

Defined in: [src/lib/a2a/services/analysis-service.ts:20](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/services/analysis-service.ts#L20)

Store analysis for a market

#### Parameters

##### marketId

`string`

##### analysis

###### marketId

`string` = `...`

###### analyst

`string` = `...`

###### prediction

`number` = `...`

###### confidence

`number` = `...`

###### reasoning

`string` = `...`

###### dataPoints

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\> = `...`

###### timestamp

`number` = `...`

###### signature?

`string` = `...`

#### Returns

`string`

***

### getAnalyses()

> **getAnalyses**(`marketId`, `limit`): `object`[]

Defined in: [src/lib/a2a/services/analysis-service.ts:49](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/services/analysis-service.ts#L49)

Get analyses for a market

#### Parameters

##### marketId

`string`

##### limit

`number` = `50`

#### Returns

`object`[]

***

### getAllAnalyses()

> **getAllAnalyses**(): `Map`\<`string`, `object`[]\>

Defined in: [src/lib/a2a/services/analysis-service.ts:57](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/services/analysis-service.ts#L57)

Get all analyses across all markets

#### Returns

`Map`\<`string`, `object`[]\>

***

### getAnalysisCount()

> **getAnalysisCount**(`marketId`): `number`

Defined in: [src/lib/a2a/services/analysis-service.ts:64](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/services/analysis-service.ts#L64)

Get analysis count for a market

#### Parameters

##### marketId

`string`

#### Returns

`number`

***

### cleanupOldAnalyses()

> **cleanupOldAnalyses**(): `void`

Defined in: [src/lib/a2a/services/analysis-service.ts:71](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/services/analysis-service.ts#L71)

Clear old analyses (called periodically)

#### Returns

`void`

***

### getStatistics()

> **getStatistics**(): `object`

Defined in: [src/lib/a2a/services/analysis-service.ts:99](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/services/analysis-service.ts#L99)

Get analysis statistics

#### Returns

`object`

##### totalMarkets

> **totalMarkets**: `number`

##### totalAnalyses

> **totalAnalyses**: `number`

##### averagePerMarket

> **averagePerMarket**: `number`
