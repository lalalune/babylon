[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/perp-settlement-service](../README.md) / PerpSettlementService

# Class: PerpSettlementService

Defined in: [src/lib/services/perp-settlement-service.ts:26](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-settlement-service.ts#L26)

## Constructors

### Constructor

> **new PerpSettlementService**(): `PerpSettlementService`

#### Returns

`PerpSettlementService`

## Methods

### initialize()

> `static` **initialize**(): `void`

Defined in: [src/lib/services/perp-settlement-service.ts:33](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-settlement-service.ts#L33)

Initialize settlement service (for hybrid mode)

#### Returns

`void`

***

### shutdown()

> `static` **shutdown**(): `void`

Defined in: [src/lib/services/perp-settlement-service.ts:53](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-settlement-service.ts#L53)

Shutdown settlement service

#### Returns

`void`

***

### settleOpenPosition()

> `static` **settleOpenPosition**(`position`): `Promise`\<[`SettlementResult`](../interfaces/SettlementResult.md)\>

Defined in: [src/lib/services/perp-settlement-service.ts:63](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-settlement-service.ts#L63)

Settle position opening to blockchain

#### Parameters

##### position

`PerpPosition`

#### Returns

`Promise`\<[`SettlementResult`](../interfaces/SettlementResult.md)\>

***

### settleClosePosition()

> `static` **settleClosePosition**(`position`): `Promise`\<[`SettlementResult`](../interfaces/SettlementResult.md)\>

Defined in: [src/lib/services/perp-settlement-service.ts:96](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-settlement-service.ts#L96)

Settle position closing to blockchain

#### Parameters

##### position

`PerpPosition`

#### Returns

`Promise`\<[`SettlementResult`](../interfaces/SettlementResult.md)\>

***

### getSettlementStats()

> `static` **getSettlementStats**(): `Promise`\<\{ `mode`: `string`; `unsettledCount`: `number`; `totalPositions`: `number`; `settlementRate`: `number`; \}\>

Defined in: [src/lib/services/perp-settlement-service.ts:342](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-settlement-service.ts#L342)

Get settlement stats

#### Returns

`Promise`\<\{ `mode`: `string`; `unsettledCount`: `number`; `totalPositions`: `number`; `settlementRate`: `number`; \}\>
