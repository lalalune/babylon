[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/waitlist-service](../README.md) / WaitlistService

# Class: WaitlistService

Defined in: [src/lib/services/waitlist-service.ts:34](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/waitlist-service.ts#L34)

## Constructors

### Constructor

> **new WaitlistService**(): `WaitlistService`

#### Returns

`WaitlistService`

## Methods

### generateInviteCode()

> `static` **generateInviteCode**(): `string`

Defined in: [src/lib/services/waitlist-service.ts:38](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/waitlist-service.ts#L38)

Generate a unique invite code

#### Returns

`string`

***

### markAsWaitlisted()

> `static` **markAsWaitlisted**(`userId`, `referralCode?`): `Promise`\<[`WaitlistMarkResult`](../interfaces/WaitlistMarkResult.md)\>

Defined in: [src/lib/services/waitlist-service.ts:46](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/waitlist-service.ts#L46)

Mark an existing user as waitlisted (after they complete onboarding)
NOTE: Users should be created through normal onboarding flow first

#### Parameters

##### userId

`string`

##### referralCode?

`string`

#### Returns

`Promise`\<[`WaitlistMarkResult`](../interfaces/WaitlistMarkResult.md)\>

***

### graduateFromWaitlist()

> `static` **graduateFromWaitlist**(`userId`): `Promise`\<`boolean`\>

Defined in: [src/lib/services/waitlist-service.ts:216](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/waitlist-service.ts#L216)

Graduate a user from waitlist to full access

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getWaitlistPosition()

> `static` **getWaitlistPosition**(`userId`): `Promise`\<[`WaitlistPosition`](../interfaces/WaitlistPosition.md) \| `null`\>

Defined in: [src/lib/services/waitlist-service.ts:239](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/waitlist-service.ts#L239)

Get user's waitlist position and stats
CRITICAL: Position is based on INVITE POINTS (leaderboard rank), not signup order!
This creates the viral loop incentive.

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`WaitlistPosition`](../interfaces/WaitlistPosition.md) \| `null`\>

***

### awardEmailBonus()

> `static` **awardEmailBonus**(`userId`, `email`): `Promise`\<`boolean`\>

Defined in: [src/lib/services/waitlist-service.ts:310](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/waitlist-service.ts#L310)

Award bonus points for email verification

#### Parameters

##### userId

`string`

##### email

`string`

#### Returns

`Promise`\<`boolean`\>

***

### awardWalletBonus()

> `static` **awardWalletBonus**(`userId`, `walletAddress`): `Promise`\<`boolean`\>

Defined in: [src/lib/services/waitlist-service.ts:373](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/waitlist-service.ts#L373)

Award bonus points for wallet connection

#### Parameters

##### userId

`string`

##### walletAddress

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getTotalWaitlistCount()

> `static` **getTotalWaitlistCount**(): `Promise`\<`number`\>

Defined in: [src/lib/services/waitlist-service.ts:435](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/waitlist-service.ts#L435)

Get total waitlist count

#### Returns

`Promise`\<`number`\>

***

### getTopWaitlistUsers()

> `static` **getTopWaitlistUsers**(`limit`): `Promise`\<`object`[]\>

Defined in: [src/lib/services/waitlist-service.ts:448](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/waitlist-service.ts#L448)

Get top waitlist users (leaderboard)
Sorted by invite points (most invites = best position)

#### Parameters

##### limit

`number` = `10`

#### Returns

`Promise`\<`object`[]\>
