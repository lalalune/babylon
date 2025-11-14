[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/npc-interaction-tracker](../README.md) / NPCInteractionTracker

# Class: NPCInteractionTracker

Defined in: [src/lib/services/npc-interaction-tracker.ts:33](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/npc-interaction-tracker.ts#L33)

## Constructors

### Constructor

> **new NPCInteractionTracker**(): `NPCInteractionTracker`

#### Returns

`NPCInteractionTracker`

## Methods

### trackLike()

> `static` **trackLike**(`userId`, `postId`): `Promise`\<`void`\>

Defined in: [src/lib/services/npc-interaction-tracker.ts:48](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/npc-interaction-tracker.ts#L48)

Track a like interaction

#### Parameters

##### userId

`string`

##### postId

`string`

#### Returns

`Promise`\<`void`\>

***

### trackShare()

> `static` **trackShare**(`userId`, `postId`): `Promise`\<`void`\>

Defined in: [src/lib/services/npc-interaction-tracker.ts:83](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/npc-interaction-tracker.ts#L83)

Track a share/retweet interaction

#### Parameters

##### userId

`string`

##### postId

`string`

#### Returns

`Promise`\<`void`\>

***

### calculateEngagementScore()

> `static` **calculateEngagementScore**(`userId`, `npcId`, `window?`): `Promise`\<[`NPCInteractionScore`](../interfaces/NPCInteractionScore.md)\>

Defined in: [src/lib/services/npc-interaction-tracker.ts:117](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/npc-interaction-tracker.ts#L117)

Calculate engagement score for a user with an NPC

#### Parameters

##### userId

`string`

##### npcId

`string`

##### window?

[`InteractionWindow`](../interfaces/InteractionWindow.md)

#### Returns

`Promise`\<[`NPCInteractionScore`](../interfaces/NPCInteractionScore.md)\>

***

### getTopEngagedUsers()

> `static` **getTopEngagedUsers**(`npcId`, `limit`, `window?`): `Promise`\<[`NPCInteractionScore`](../interfaces/NPCInteractionScore.md)[]\>

Defined in: [src/lib/services/npc-interaction-tracker.ts:264](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/npc-interaction-tracker.ts#L264)

Get top users by engagement with an NPC

#### Parameters

##### npcId

`string`

##### limit

`number` = `10`

##### window?

[`InteractionWindow`](../interfaces/InteractionWindow.md)

#### Returns

`Promise`\<[`NPCInteractionScore`](../interfaces/NPCInteractionScore.md)[]\>

***

### getUserEngagedNPCs()

> `static` **getUserEngagedNPCs**(`userId`, `window?`): `Promise`\<`string`[]\>

Defined in: [src/lib/services/npc-interaction-tracker.ts:300](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/npc-interaction-tracker.ts#L300)

Get all NPCs a user has engaged with

#### Parameters

##### userId

`string`

##### window?

[`InteractionWindow`](../interfaces/InteractionWindow.md)

#### Returns

`Promise`\<`string`[]\>
