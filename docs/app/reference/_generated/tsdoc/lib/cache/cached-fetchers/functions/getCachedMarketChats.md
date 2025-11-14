[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-fetchers](../README.md) / getCachedMarketChats

# Function: getCachedMarketChats()

> **getCachedMarketChats**(): `Promise`\<\{ `success`: `boolean`; `chats`: `object`[]; \}\>

Defined in: [src/lib/cache/cached-fetchers.ts:619](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-fetchers.ts#L619)

Get all prediction market chats (shared)
Uses 'use cache: remote' for dynamic context caching
Cache tag: 'chats:markets' for granular invalidation
Cache life: 1 minute (60 seconds) - chat lists change frequently

## Returns

`Promise`\<\{ `success`: `boolean`; `chats`: `object`[]; \}\>
