[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/group-chat-sweep](../README.md) / GroupChatSweep

# Class: GroupChatSweep

Defined in: [src/lib/services/group-chat-sweep.ts:26](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-sweep.ts#L26)

## Constructors

### Constructor

> **new GroupChatSweep**(): `GroupChatSweep`

#### Returns

`GroupChatSweep`

## Methods

### calculateKickChance()

> `static` **calculateKickChance**(`userId`, `chatId`): `Promise`\<[`SweepDecision`](../interfaces/SweepDecision.md)\>

Defined in: [src/lib/services/group-chat-sweep.ts:44](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-sweep.ts#L44)

Calculate the probability that a user should be removed from a group chat.

#### Parameters

##### userId

`string`

##### chatId

`string`

#### Returns

`Promise`\<[`SweepDecision`](../interfaces/SweepDecision.md)\>

***

### removeFromChat()

> `static` **removeFromChat**(`userId`, `chatId`, `reason`): `Promise`\<`void`\>

Defined in: [src/lib/services/group-chat-sweep.ts:160](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-sweep.ts#L160)

Remove a user from a group chat

#### Parameters

##### userId

`string`

##### chatId

`string`

##### reason

`string`

#### Returns

`Promise`\<`void`\>

***

### sweepChat()

> `static` **sweepChat**(`chatId`): `Promise`\<\{ `checked`: `number`; `removed`: `number`; `reasons`: `Record`\<`string`, `number`\>; \}\>

Defined in: [src/lib/services/group-chat-sweep.ts:182](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-sweep.ts#L182)

Run sweep on all members of a chat

#### Parameters

##### chatId

`string`

#### Returns

`Promise`\<\{ `checked`: `number`; `removed`: `number`; `reasons`: `Record`\<`string`, `number`\>; \}\>

***

### sweepAllChats()

> `static` **sweepAllChats**(): `Promise`\<\{ `chatsChecked`: `number`; `totalRemoved`: `number`; `reasonsSummary`: `Record`\<`string`, `number`\>; \}\>

Defined in: [src/lib/services/group-chat-sweep.ts:220](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-sweep.ts#L220)

Run sweep on all group chats

#### Returns

`Promise`\<\{ `chatsChecked`: `number`; `totalRemoved`: `number`; `reasonsSummary`: `Record`\<`string`, `number`\>; \}\>

***

### updateQualityScore()

> `static` **updateQualityScore**(`userId`, `chatId`, `newMessageQuality`): `Promise`\<`void`\>

Defined in: [src/lib/services/group-chat-sweep.ts:257](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-sweep.ts#L257)

Update user's quality score in chat

#### Parameters

##### userId

`string`

##### chatId

`string`

##### newMessageQuality

`number`

#### Returns

`Promise`\<`void`\>
