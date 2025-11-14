[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/earned-points-service](../README.md) / EarnedPointsService

# Class: EarnedPointsService

Defined in: [src/lib/services/earned-points-service.ts:10](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/earned-points-service.ts#L10)

## Constructors

### Constructor

> **new EarnedPointsService**(): `EarnedPointsService`

#### Returns

`EarnedPointsService`

## Methods

### pnlToPoints()

> `static` **pnlToPoints**(`pnl`): `number`

Defined in: [src/lib/services/earned-points-service.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/earned-points-service.ts#L17)

Convert P&L to earned points
Formula: 1 point per $10 of realized P&L
Minimum: -100 points (can't go below -100)
This encourages trading but limits downside risk

#### Parameters

##### pnl

`number`

#### Returns

`number`

***

### syncEarnedPointsFromPnL()

> `static` **syncEarnedPointsFromPnL**(`userId`): `Promise`\<`void`\>

Defined in: [src/lib/services/earned-points-service.ts:27](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/earned-points-service.ts#L27)

Update earned points based on current lifetime P&L
This recalculates earned points from scratch based on lifetimePnL

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>

***

### awardEarnedPointsForPnL()

> `static` **awardEarnedPointsForPnL**(`userId`, `previousLifetimePnL`, `newLifetimePnL`, `tradeType`, `relatedId?`): `Promise`\<`number`\>

Defined in: [src/lib/services/earned-points-service.ts:76](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/earned-points-service.ts#L76)

Award earned points for a specific P&L amount (for incremental updates)
Use this when recording a trade's P&L

#### Parameters

##### userId

`string`

##### previousLifetimePnL

`number`

##### newLifetimePnL

`number`

##### tradeType

`string`

##### relatedId?

`string`

#### Returns

`Promise`\<`number`\>

***

### bulkSyncAllUsers()

> `static` **bulkSyncAllUsers**(): `Promise`\<\{ `success`: `number`; `errors`: `number`; \}\>

Defined in: [src/lib/services/earned-points-service.ts:168](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/earned-points-service.ts#L168)

Bulk sync earned points for all users
Useful for migration or recalculation
Note: Individual user errors are caught to allow continuation

#### Returns

`Promise`\<\{ `success`: `number`; `errors`: `number`; \}\>
