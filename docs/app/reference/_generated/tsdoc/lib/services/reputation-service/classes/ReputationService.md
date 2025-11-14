[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/reputation-service](../README.md) / ReputationService

# Class: ReputationService

Defined in: [src/lib/services/reputation-service.ts:37](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reputation-service.ts#L37)

## Constructors

### Constructor

> **new ReputationService**(): `ReputationService`

#### Returns

`ReputationService`

## Methods

### updateReputationForResolvedMarket()

> `static` **updateReputationForResolvedMarket**(`resolution`): `Promise`\<`ReputationUpdate`[]\>

Defined in: [src/lib/services/reputation-service.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reputation-service.ts#L42)

Update reputation for all users who had positions in a resolved market
Called after a prediction market question resolves

#### Parameters

##### resolution

`MarketResolution`

#### Returns

`Promise`\<`ReputationUpdate`[]\>

***

### getOnChainReputation()

> `static` **getOnChainReputation**(`userId`): `Promise`\<`number` \| `null`\>

Defined in: [src/lib/services/reputation-service.ts:145](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reputation-service.ts#L145)

Get current on-chain reputation for a user

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`number` \| `null`\>

***

### syncUserReputation()

> `static` **syncUserReputation**(`userId`): `Promise`\<`number` \| `null`\>

Defined in: [src/lib/services/reputation-service.ts:182](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reputation-service.ts#L182)

Sync database reputation with on-chain reputation
Useful for keeping local cache up-to-date

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`number` \| `null`\>

***

### batchUpdateReputation()

> `static` **batchUpdateReputation**(`resolutions`): `Promise`\<`Record`\<`string`, `ReputationUpdate`[]\>\>

Defined in: [src/lib/services/reputation-service.ts:202](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reputation-service.ts#L202)

Batch update reputation for multiple market resolutions
Useful when processing multiple resolved markets at once

#### Parameters

##### resolutions

`MarketResolution`[]

#### Returns

`Promise`\<`Record`\<`string`, `ReputationUpdate`[]\>\>
