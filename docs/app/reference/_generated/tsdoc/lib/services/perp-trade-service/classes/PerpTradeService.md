[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/perp-trade-service](../README.md) / PerpTradeService

# Class: PerpTradeService

Defined in: [src/lib/services/perp-trade-service.ts:80](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-trade-service.ts#L80)

## Constructors

### Constructor

> **new PerpTradeService**(): `PerpTradeService`

#### Returns

`PerpTradeService`

## Methods

### openPosition()

> `static` **openPosition**(`authUser`, `input`): `Promise`\<[`OpenPerpPositionResult`](../interfaces/OpenPerpPositionResult.md)\>

Defined in: [src/lib/services/perp-trade-service.ts:81](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-trade-service.ts#L81)

#### Parameters

##### authUser

[`AuthenticatedUser`](../../../api/auth-middleware/interfaces/AuthenticatedUser.md)

##### input

[`OpenPerpPositionInput`](../interfaces/OpenPerpPositionInput.md)

#### Returns

`Promise`\<[`OpenPerpPositionResult`](../interfaces/OpenPerpPositionResult.md)\>

***

### closePosition()

> `static` **closePosition**(`authUser`, `positionId`): `Promise`\<[`ClosePerpPositionResult`](../interfaces/ClosePerpPositionResult.md)\>

Defined in: [src/lib/services/perp-trade-service.ts:256](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-trade-service.ts#L256)

#### Parameters

##### authUser

[`AuthenticatedUser`](../../../api/auth-middleware/interfaces/AuthenticatedUser.md)

##### positionId

`string`

#### Returns

`Promise`\<[`ClosePerpPositionResult`](../interfaces/ClosePerpPositionResult.md)\>
