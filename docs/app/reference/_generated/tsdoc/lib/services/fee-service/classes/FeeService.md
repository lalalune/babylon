[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/fee-service](../README.md) / FeeService

# Class: FeeService

Defined in: [src/lib/services/fee-service.ts:50](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/fee-service.ts#L50)

## Constructors

### Constructor

> **new FeeService**(): `FeeService`

#### Returns

`FeeService`

## Methods

### calculateFee()

> `static` **calculateFee**(`tradeAmount`): [`FeeCalculation`](../interfaces/FeeCalculation.md)

Defined in: [src/lib/services/fee-service.ts:54](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/fee-service.ts#L54)

Calculate fee for a trade amount

#### Parameters

##### tradeAmount

`number`

#### Returns

[`FeeCalculation`](../interfaces/FeeCalculation.md)

***

### calculateFeeOnProceeds()

> `static` **calculateFeeOnProceeds**(`proceeds`): [`FeeCalculation`](../interfaces/FeeCalculation.md)

Defined in: [src/lib/services/fee-service.ts:71](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/fee-service.ts#L71)

Calculate fee on proceeds (for selling)

#### Parameters

##### proceeds

`number`

#### Returns

[`FeeCalculation`](../interfaces/FeeCalculation.md)

***

### processTradingFee()

> `static` **processTradingFee**(`userId`, `tradeType`, `tradeAmount`, `tradeId?`, `marketId?`): `Promise`\<[`FeeDistributionResult`](../interfaces/FeeDistributionResult.md)\>

Defined in: [src/lib/services/fee-service.ts:78](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/fee-service.ts#L78)

Process trading fee - charge user and distribute to platform/referrer

#### Parameters

##### userId

`string`

##### tradeType

[`FeeType`](../../../config/fees/type-aliases/FeeType.md)

##### tradeAmount

`number`

##### tradeId?

`string`

##### marketId?

`string`

#### Returns

`Promise`\<[`FeeDistributionResult`](../interfaces/FeeDistributionResult.md)\>

***

### getUserReferrer()

> `static` **getUserReferrer**(`userId`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/services/fee-service.ts:160](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/fee-service.ts#L160)

Get user's referrer

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### distributeReferralFee()

> `static` **distributeReferralFee**(`referrerId`, `feeAmount`, `traderId`, `tx`): `Promise`\<`void`\>

Defined in: [src/lib/services/fee-service.ts:172](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/fee-service.ts#L172)

Distribute referral fee to referrer

#### Parameters

##### referrerId

`string`

##### feeAmount

`number`

##### traderId

`string`

##### tx

`Omit`\<*typeof* [`prisma`](../../../prisma/variables/prisma.md), `"$connect"` \| `"$disconnect"` \| `"$on"` \| `"$transaction"` \| `"$use"` \| `"$extends"`\>

#### Returns

`Promise`\<`void`\>

***

### getReferralEarnings()

> `static` **getReferralEarnings**(`userId`, `options?`): `Promise`\<[`ReferralEarnings`](../interfaces/ReferralEarnings.md)\>

Defined in: [src/lib/services/fee-service.ts:227](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/fee-service.ts#L227)

Get referral fee earnings for a user

#### Parameters

##### userId

`string`

##### options?

###### startDate?

`Date`

###### endDate?

`Date`

###### limit?

`number`

#### Returns

`Promise`\<[`ReferralEarnings`](../interfaces/ReferralEarnings.md)\>

***

### getPlatformFeeStats()

> `static` **getPlatformFeeStats**(`startDate?`, `endDate?`): `Promise`\<\{ `totalFeesCollected`: `number`; `totalReferrerFees`: `number`; `totalPlatformFees`: `number`; `totalTrades`: `number`; \}\>

Defined in: [src/lib/services/fee-service.ts:355](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/fee-service.ts#L355)

Get fee statistics for the platform

#### Parameters

##### startDate?

`Date`

##### endDate?

`Date`

#### Returns

`Promise`\<\{ `totalFeesCollected`: `number`; `totalReferrerFees`: `number`; `totalPlatformFees`: `number`; `totalTrades`: `number`; \}\>
