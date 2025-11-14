[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/reply-rate-limiter](../README.md) / ReplyRateLimiter

# Class: ReplyRateLimiter

Defined in: [src/lib/services/reply-rate-limiter.ts:23](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reply-rate-limiter.ts#L23)

## Constructors

### Constructor

> **new ReplyRateLimiter**(): `ReplyRateLimiter`

#### Returns

`ReplyRateLimiter`

## Methods

### getExpectedNextReplyTime()

> `static` **getExpectedNextReplyTime**(`lastReplyTime`): `Date`

Defined in: [src/lib/services/reply-rate-limiter.ts:30](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reply-rate-limiter.ts#L30)

#### Parameters

##### lastReplyTime

`Date`

#### Returns

`Date`

***

### canReply()

> `static` **canReply**(`userId`, `npcId`): `Promise`\<[`RateLimitResult`](../interfaces/RateLimitResult.md)\>

Defined in: [src/lib/services/reply-rate-limiter.ts:37](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reply-rate-limiter.ts#L37)

Check if user can reply to an NPC's post

#### Parameters

##### userId

`string`

##### npcId

`string`

#### Returns

`Promise`\<[`RateLimitResult`](../interfaces/RateLimitResult.md)\>

***

### recordReply()

> `static` **recordReply**(`userId`, `npcId`, `postId`, `commentId`, `qualityScore`): `Promise`\<`void`\>

Defined in: [src/lib/services/reply-rate-limiter.ts:149](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reply-rate-limiter.ts#L149)

Record a reply interaction

#### Parameters

##### userId

`string`

##### npcId

`string`

##### postId

`string`

##### commentId

`string`

##### qualityScore

`number`

#### Returns

`Promise`\<`void`\>

***

### getReplyStats()

> `static` **getReplyStats**(`userId`, `npcId`): `Promise`\<\{ `totalReplies`: `number`; `currentStreak`: `number`; `longestStreak`: `number`; `averageQuality`: `number`; `lastReplyAt`: `null`; \} \| \{ `totalReplies`: `number`; `currentStreak`: `number`; `longestStreak`: `number`; `averageQuality`: `number`; `lastReplyAt`: `Date` \| `undefined`; \}\>

Defined in: [src/lib/services/reply-rate-limiter.ts:172](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reply-rate-limiter.ts#L172)

Get user's reply statistics for an NPC

#### Parameters

##### userId

`string`

##### npcId

`string`

#### Returns

`Promise`\<\{ `totalReplies`: `number`; `currentStreak`: `number`; `longestStreak`: `number`; `averageQuality`: `number`; `lastReplyAt`: `null`; \} \| \{ `totalReplies`: `number`; `currentStreak`: `number`; `longestStreak`: `number`; `averageQuality`: `number`; `lastReplyAt`: `Date` \| `undefined`; \}\>

***

### getAllReplyStats()

> `static` **getAllReplyStats**(`userId`): `Promise`\<(\{ `totalReplies`: `number`; `currentStreak`: `number`; `longestStreak`: `number`; `averageQuality`: `number`; `lastReplyAt`: `null`; `npcId`: `string`; \} \| \{ `totalReplies`: `number`; `currentStreak`: `number`; `longestStreak`: `number`; `averageQuality`: `number`; `lastReplyAt`: `Date` \| `undefined`; `npcId`: `string`; \})[]\>

Defined in: [src/lib/services/reply-rate-limiter.ts:209](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/reply-rate-limiter.ts#L209)

Get all NPCs user has replied to with their stats

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<(\{ `totalReplies`: `number`; `currentStreak`: `number`; `longestStreak`: `number`; `averageQuality`: `number`; `lastReplyAt`: `null`; `npcId`: `string`; \} \| \{ `totalReplies`: `number`; `currentStreak`: `number`; `longestStreak`: `number`; `averageQuality`: `number`; `lastReplyAt`: `Date` \| `undefined`; `npcId`: `string`; \})[]\>
