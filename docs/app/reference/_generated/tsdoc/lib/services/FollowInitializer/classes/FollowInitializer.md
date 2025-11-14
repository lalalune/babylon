[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/FollowInitializer](../README.md) / FollowInitializer

# Class: FollowInitializer

Defined in: [src/lib/services/FollowInitializer.ts:33](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/FollowInitializer.ts#L33)

## Constructors

### Constructor

> **new FollowInitializer**(): `FollowInitializer`

#### Returns

`FollowInitializer`

## Methods

### initializeActorFollows()

> `static` **initializeActorFollows**(): `Promise`\<`void`\>

Defined in: [src/lib/services/FollowInitializer.ts:37](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/FollowInitializer.ts#L37)

Initialize all actor follows from relationships

#### Returns

`Promise`\<`void`\>

***

### loadAndInitialize()

> `static` **loadAndInitialize**(`filePath`): `Promise`\<`void`\>

Defined in: [src/lib/services/FollowInitializer.ts:83](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/FollowInitializer.ts#L83)

Load relationships from JSON file and initialize

#### Parameters

##### filePath

`string`

#### Returns

`Promise`\<`void`\>

***

### importRelationships()

> `static` **importRelationships**(`relationships`): `Promise`\<`void`\>

Defined in: [src/lib/services/FollowInitializer.ts:107](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/FollowInitializer.ts#L107)

Import relationships to database

#### Parameters

##### relationships

[`RelationshipData`](../interfaces/RelationshipData.md)[]

#### Returns

`Promise`\<`void`\>

***

### createFollows()

> `static` **createFollows**(`relationships`): `Promise`\<`void`\>

Defined in: [src/lib/services/FollowInitializer.ts:139](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/FollowInitializer.ts#L139)

Create ActorFollow records from relationship data

#### Parameters

##### relationships

[`RelationshipData`](../interfaces/RelationshipData.md)[]

#### Returns

`Promise`\<`void`\>

***

### verifyFollowerCounts()

> `static` **verifyFollowerCounts**(): `Promise`\<[`VerificationReport`](../interfaces/VerificationReport.md)\>

Defined in: [src/lib/services/FollowInitializer.ts:197](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/FollowInitializer.ts#L197)

Verify all actors have minimum follower count

#### Returns

`Promise`\<[`VerificationReport`](../interfaces/VerificationReport.md)\>

***

### ensureMinimumFollowers()

> `static` **ensureMinimumFollowers**(`minFollowers`): `Promise`\<`void`\>

Defined in: [src/lib/services/FollowInitializer.ts:251](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/FollowInitializer.ts#L251)

Ensure all actors have at least minimum followers

#### Parameters

##### minFollowers

`number`

#### Returns

`Promise`\<`void`\>
