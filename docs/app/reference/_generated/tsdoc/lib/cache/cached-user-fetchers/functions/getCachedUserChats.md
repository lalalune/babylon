[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-user-fetchers](../README.md) / getCachedUserChats

# Function: getCachedUserChats()

> **getCachedUserChats**(`userId`): `Promise`\<\{ `success`: `boolean`; `groupChats`: `GroupChatType`[]; `directChats`: `object`[]; `total`: `number`; \}\>

Defined in: [src/lib/cache/cached-user-fetchers.ts:432](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-user-fetchers.ts#L432)

Get user chats (user-specific)
Uses 'use cache: private' for personalized chat caching
Cache tag: 'chats:user' for granular invalidation
Cache life: 30 seconds - chat lists update frequently

## Parameters

### userId

`string`

## Returns

`Promise`\<\{ `success`: `boolean`; `groupChats`: `GroupChatType`[]; `directChats`: `object`[]; `total`: `number`; \}\>
