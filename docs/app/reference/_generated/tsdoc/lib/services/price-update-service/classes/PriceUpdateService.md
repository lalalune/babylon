[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/price-update-service](../README.md) / PriceUpdateService

# Class: PriceUpdateService

Defined in: [src/lib/services/price-update-service.ts:54](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/price-update-service.ts#L54)

## Constructors

### Constructor

> **new PriceUpdateService**(): `PriceUpdateService`

#### Returns

`PriceUpdateService`

## Methods

### applyUpdates()

> `static` **applyUpdates**(`updates`): `Promise`\<[`AppliedPriceUpdate`](../interfaces/AppliedPriceUpdate.md)[]\>

Defined in: [src/lib/services/price-update-service.ts:58](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/price-update-service.ts#L58)

Apply a batch of price updates, ensuring persistence + engine sync + SSE broadcast + on-chain storage

#### Parameters

##### updates

[`PriceUpdateInput`](../interfaces/PriceUpdateInput.md)[]

#### Returns

`Promise`\<[`AppliedPriceUpdate`](../interfaces/AppliedPriceUpdate.md)[]\>
