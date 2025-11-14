[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/RelationshipManager](../README.md) / RelationshipManager

# Class: RelationshipManager

Defined in: [src/lib/services/RelationshipManager.ts:43](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L43)

## Constructors

### Constructor

> **new RelationshipManager**(): `RelationshipManager`

#### Returns

`RelationshipManager`

## Methods

### getActorRelationships()

> `static` **getActorRelationships**(`actorId`): `Promise`\<[`ActorRelationship`](../../../../engine/FeedGenerator/interfaces/ActorRelationship.md)[]\>

Defined in: [src/lib/services/RelationshipManager.ts:47](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L47)

Get all relationships for an actor

#### Parameters

##### actorId

`string`

#### Returns

`Promise`\<[`ActorRelationship`](../../../../engine/FeedGenerator/interfaces/ActorRelationship.md)[]\>

***

### getRelationship()

> `static` **getRelationship**(`actor1Id`, `actor2Id`): `Promise`\<[`ActorRelationship`](../../../../engine/FeedGenerator/interfaces/ActorRelationship.md) \| `null`\>

Defined in: [src/lib/services/RelationshipManager.ts:93](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L93)

Get specific relationship between two actors

#### Parameters

##### actor1Id

`string`

##### actor2Id

`string`

#### Returns

`Promise`\<[`ActorRelationship`](../../../../engine/FeedGenerator/interfaces/ActorRelationship.md) \| `null`\>

***

### getFollowing()

> `static` **getFollowing**(`actorId`): `Promise`\<[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md) & `object`[]\>

Defined in: [src/lib/services/RelationshipManager.ts:126](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L126)

Get actors that this actor follows

#### Parameters

##### actorId

`string`

#### Returns

`Promise`\<[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md) & `object`[]\>

***

### getFollowers()

> `static` **getFollowers**(`actorId`): `Promise`\<[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md) & `object`[]\>

Defined in: [src/lib/services/RelationshipManager.ts:148](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L148)

Get actors that follow this actor

#### Parameters

##### actorId

`string`

#### Returns

`Promise`\<[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md) & `object`[]\>

***

### isFollowing()

> `static` **isFollowing**(`actor1Id`, `actor2Id`): `Promise`\<`boolean`\>

Defined in: [src/lib/services/RelationshipManager.ts:170](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L170)

Check if actor1 follows actor2

#### Parameters

##### actor1Id

`string`

##### actor2Id

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getRelationshipContext()

> `static` **getRelationshipContext**(`actorId`, `relevantActorIds`): `Promise`\<[`RelationshipContext`](../interfaces/RelationshipContext.md)\>

Defined in: [src/lib/services/RelationshipManager.ts:186](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L186)

Get relationship context for LLM prompts

#### Parameters

##### actorId

`string`

##### relevantActorIds

`string`[]

#### Returns

`Promise`\<[`RelationshipContext`](../interfaces/RelationshipContext.md)\>

***

### getRelatedActors()

> `static` **getRelatedActors**(`actorId`, `count`, `relationshipTypes?`): `Promise`\<[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md)[]\>

Defined in: [src/lib/services/RelationshipManager.ts:290](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L290)

Get related actors for events and content generation

#### Parameters

##### actorId

`string`

##### count

`number`

##### relationshipTypes?

`string`[]

#### Returns

`Promise`\<[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md)[]\>

***

### getRelationshipStats()

> `static` **getRelationshipStats**(`actorId`): `Promise`\<[`RelationshipStats`](../interfaces/RelationshipStats.md)\>

Defined in: [src/lib/services/RelationshipManager.ts:338](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L338)

Get relationship statistics for an actor

#### Parameters

##### actorId

`string`

#### Returns

`Promise`\<[`RelationshipStats`](../interfaces/RelationshipStats.md)\>

***

### getActorsWithNoFollowers()

> `static` **getActorsWithNoFollowers**(): `Promise`\<[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md)[]\>

Defined in: [src/lib/services/RelationshipManager.ts:383](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L383)

Get actors with no followers (for verification/fixing)

#### Returns

`Promise`\<[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md)[]\>

***

### getRelationshipModifiers()

> `static` **getRelationshipModifiers**(`relationship`): `object`

Defined in: [src/lib/services/RelationshipManager.ts:398](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/RelationshipManager.ts#L398)

Get relationship behavioral modifiers

#### Parameters

##### relationship

[`ActorRelationship`](../../../../engine/FeedGenerator/interfaces/ActorRelationship.md)

#### Returns

`object`

##### mentionLikelihood

> **mentionLikelihood**: `number`

##### postFrequency

> **postFrequency**: `number`

##### supportLikelihood

> **supportLikelihood**: `number`

##### attackLikelihood

> **attackLikelihood**: `number`
