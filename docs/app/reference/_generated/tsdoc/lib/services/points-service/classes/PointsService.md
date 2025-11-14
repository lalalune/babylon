[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/points-service](../README.md) / PointsService

# Class: PointsService

Defined in: [src/lib/services/points-service.ts:24](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L24)

## Constructors

### Constructor

> **new PointsService**(): `PointsService`

#### Returns

`PointsService`

## Methods

### awardPoints()

> `static` **awardPoints**(`userId`, `amount`, `reason`, `metadata?`): `Promise`\<`AwardPointsResult`\>

Defined in: [src/lib/services/points-service.ts:28](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L28)

Award points to a user with transaction tracking

#### Parameters

##### userId

`string`

##### amount

`number`

##### reason

[`PointsReason`](../../../constants/points/type-aliases/PointsReason.md)

##### metadata?

`Record`\<`string`, `JsonValue`\>

#### Returns

`Promise`\<`AwardPointsResult`\>

***

### awardProfileCompletion()

> `static` **awardProfileCompletion**(`userId`): `Promise`\<`AwardPointsResult`\>

Defined in: [src/lib/services/points-service.ts:153](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L153)

Award points for profile completion (username + image + bio)
This consolidates what were previously separate rewards

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`AwardPointsResult`\>

***

### awardFarcasterLink()

> `static` **awardFarcasterLink**(`userId`, `farcasterUsername?`): `Promise`\<`AwardPointsResult`\>

Defined in: [src/lib/services/points-service.ts:166](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L166)

Award points for Farcaster link

#### Parameters

##### userId

`string`

##### farcasterUsername?

`string`

#### Returns

`Promise`\<`AwardPointsResult`\>

***

### awardTwitterLink()

> `static` **awardTwitterLink**(`userId`, `twitterUsername?`): `Promise`\<`AwardPointsResult`\>

Defined in: [src/lib/services/points-service.ts:181](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L181)

Award points for Twitter link

#### Parameters

##### userId

`string`

##### twitterUsername?

`string`

#### Returns

`Promise`\<`AwardPointsResult`\>

***

### awardWalletConnect()

> `static` **awardWalletConnect**(`userId`, `walletAddress?`): `Promise`\<`AwardPointsResult`\>

Defined in: [src/lib/services/points-service.ts:196](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L196)

Award points for wallet connection

#### Parameters

##### userId

`string`

##### walletAddress?

`string`

#### Returns

`Promise`\<`AwardPointsResult`\>

***

### awardShareAction()

> `static` **awardShareAction**(`userId`, `platform`, `contentType`, `contentId?`): `Promise`\<`AwardPointsResult`\>

Defined in: [src/lib/services/points-service.ts:211](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L211)

Award points for share action

#### Parameters

##### userId

`string`

##### platform

`string`

##### contentType

`string`

##### contentId?

`string`

#### Returns

`Promise`\<`AwardPointsResult`\>

***

### awardReferralSignup()

> `static` **awardReferralSignup**(`referrerId`, `referredUserId`): `Promise`\<`AwardPointsResult`\>

Defined in: [src/lib/services/points-service.ts:231](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L231)

Award points for referral signup

#### Parameters

##### referrerId

`string`

##### referredUserId

`string`

#### Returns

`Promise`\<`AwardPointsResult`\>

***

### purchasePoints()

> `static` **purchasePoints**(`userId`, `amountUSD`, `paymentRequestId`, `paymentTxHash?`): `Promise`\<`AwardPointsResult`\>

Defined in: [src/lib/services/points-service.ts:256](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L256)

Purchase points via x402 payment (100 points = $1)

#### Parameters

##### userId

`string`

##### amountUSD

`number`

##### paymentRequestId

`string`

##### paymentTxHash?

`string`

#### Returns

`Promise`\<`AwardPointsResult`\>

***

### getUserPoints()

> `static` **getUserPoints**(`userId`): `Promise`\<\{ `points`: `number`; `referralCount`: `number`; `transactions`: `object`[]; \} \| `null`\>

Defined in: [src/lib/services/points-service.ts:354](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L354)

Get user's points and transaction history

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<\{ `points`: `number`; `referralCount`: `number`; `transactions`: `object`[]; \} \| `null`\>

***

### getLeaderboard()

> `static` **getLeaderboard**(`page`, `pageSize`, `minPoints`, `pointsCategory`): `Promise`\<\{ `users`: `object`[]; `totalCount`: `number`; `page`: `number`; `pageSize`: `number`; `totalPages`: `number`; `pointsCategory`: `LeaderboardCategory`; \}\>

Defined in: [src/lib/services/points-service.ts:381](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L381)

Get leaderboard with pagination (includes both Users and Actors with pools)

#### Parameters

##### page

`number` = `1`

##### pageSize

`number` = `100`

##### minPoints

`number` = `500`

##### pointsCategory

`LeaderboardCategory` = `'all'`

#### Returns

`Promise`\<\{ `users`: `object`[]; `totalCount`: `number`; `page`: `number`; `pageSize`: `number`; `totalPages`: `number`; `pointsCategory`: `LeaderboardCategory`; \}\>

***

### getUserRank()

> `static` **getUserRank**(`userId`): `Promise`\<`number` \| `null`\>

Defined in: [src/lib/services/points-service.ts:530](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/points-service.ts#L530)

Get user's rank on leaderboard (including actors)

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`number` \| `null`\>
