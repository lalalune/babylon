[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/following-mechanics](../README.md) / FollowingMechanics

# Class: FollowingMechanics

Defined in: [src/lib/services/following-mechanics.ts:32](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/following-mechanics.ts#L32)

## Constructors

### Constructor

> **new FollowingMechanics**(): `FollowingMechanics`

#### Returns

`FollowingMechanics`

## Methods

### calculateFollowingChance()

> `static` **calculateFollowingChance**(`userId`, `npcId`, `currentStreak`, `currentQualityScore`): `Promise`\<[`FollowingChance`](../interfaces/FollowingChance.md)\>

Defined in: [src/lib/services/following-mechanics.ts:45](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/following-mechanics.ts#L45)

Calculate if NPC should follow player after a reply

#### Parameters

##### userId

`string`

##### npcId

`string`

##### currentStreak

`number`

##### currentQualityScore

`number`

#### Returns

`Promise`\<[`FollowingChance`](../interfaces/FollowingChance.md)\>

***

### recordFollow()

> `static` **recordFollow**(`userId`, `npcId`, `reason`): `Promise`\<`void`\>

Defined in: [src/lib/services/following-mechanics.ts:150](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/following-mechanics.ts#L150)

Record an NPC following a player

#### Parameters

##### userId

`string`

##### npcId

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

***

### isFollowing()

> `static` **isFollowing**(`userId`, `npcId`): `Promise`\<`boolean`\>

Defined in: [src/lib/services/following-mechanics.ts:196](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/following-mechanics.ts#L196)

Check if an NPC is following a player

#### Parameters

##### userId

`string`

##### npcId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getFollowers()

> `static` **getFollowers**(`userId`): `Promise`\<`object`[]\>

Defined in: [src/lib/services/following-mechanics.ts:212](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/following-mechanics.ts#L212)

Get all NPCs following a player

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`object`[]\>

***

### unfollow()

> `static` **unfollow**(`userId`, `npcId`, `reason`): `Promise`\<`void`\>

Defined in: [src/lib/services/following-mechanics.ts:229](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/following-mechanics.ts#L229)

Unfollow (if quality drops or streak breaks badly)

#### Parameters

##### userId

`string`

##### npcId

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

***

### shouldUnfollow()

> `static` **shouldUnfollow**(`userId`, `npcId`): `Promise`\<`boolean`\>

Defined in: [src/lib/services/following-mechanics.ts:253](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/following-mechanics.ts#L253)

Check if follow should be revoked (periodic check)

#### Parameters

##### userId

`string`

##### npcId

`string`

#### Returns

`Promise`\<`boolean`\>
