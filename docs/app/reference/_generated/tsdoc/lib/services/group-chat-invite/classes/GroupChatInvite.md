[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/group-chat-invite](../README.md) / GroupChatInvite

# Class: GroupChatInvite

Defined in: [src/lib/services/group-chat-invite.ts:34](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-invite.ts#L34)

## Constructors

### Constructor

> **new GroupChatInvite**(): `GroupChatInvite`

#### Returns

`GroupChatInvite`

## Methods

### calculateInviteChance()

> `static` **calculateInviteChance**(`userId`, `npcId`): `Promise`\<[`InviteChance`](../interfaces/InviteChance.md)\>

Defined in: [src/lib/services/group-chat-invite.ts:62](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-invite.ts#L62)

Calculate if player should be invited to a group chat

#### Parameters

##### userId

`string`

##### npcId

`string`

#### Returns

`Promise`\<[`InviteChance`](../interfaces/InviteChance.md)\>

***

### recordInvite()

> `static` **recordInvite**(`userId`, `npcId`, `chatId`, `chatName`): `Promise`\<`void`\>

Defined in: [src/lib/services/group-chat-invite.ts:200](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-invite.ts#L200)

Record a group chat invite

#### Parameters

##### userId

`string`

##### npcId

`string`

##### chatId

`string`

##### chatName

`string`

#### Returns

`Promise`\<`void`\>

***

### getUserGroupChats()

> `static` **getUserGroupChats**(`userId`): `Promise`\<`GroupChatData`[]\>

Defined in: [src/lib/services/group-chat-invite.ts:265](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-invite.ts#L265)

Get all group chats a user is in

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`GroupChatData`[]\>

***

### isInChat()

> `static` **isInChat**(`userId`, `chatId`): `Promise`\<`boolean`\>

Defined in: [src/lib/services/group-chat-invite.ts:292](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/group-chat-invite.ts#L292)

Check if user is in a specific chat

#### Parameters

##### userId

`string`

##### chatId

`string`

#### Returns

`Promise`\<`boolean`\>
