[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/npc-group-dynamics-service](../README.md) / NPCGroupDynamicsService

# Class: NPCGroupDynamicsService

Defined in: [src/lib/services/npc-group-dynamics-service.ts:31](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/npc-group-dynamics-service.ts#L31)

## Constructors

### Constructor

> **new NPCGroupDynamicsService**(): `NPCGroupDynamicsService`

#### Returns

`NPCGroupDynamicsService`

## Methods

### processTickDynamics()

> `static` **processTickDynamics**(): `Promise`\<[`GroupDynamicsResult`](../interfaces/GroupDynamicsResult.md)\>

Defined in: [src/lib/services/npc-group-dynamics-service.ts:50](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/npc-group-dynamics-service.ts#L50)

Process all NPC group dynamics for one tick

#### Returns

`Promise`\<[`GroupDynamicsResult`](../interfaces/GroupDynamicsResult.md)\>

***

### getGroupStats()

> `static` **getGroupStats**(): `Promise`\<\{ `totalGroups`: `number`; `activeGroups`: `number`; `totalMembers`: `number`; `avgGroupSize`: `number`; \}\>

Defined in: [src/lib/services/npc-group-dynamics-service.ts:1036](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/npc-group-dynamics-service.ts#L1036)

Get group dynamics statistics

#### Returns

`Promise`\<\{ `totalGroups`: `number`; `activeGroups`: `number`; `totalMembers`: `number`; `avgGroupSize`: `number`; \}\>
