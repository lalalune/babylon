[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-user-fetchers](../README.md) / getCachedFollowingFeed

# Function: getCachedFollowingFeed()

> **getCachedFollowingFeed**(`userId`, `limit`, `offset`): `Promise`\<\{ `success`: `boolean`; `posts`: `object`[]; `total`: `number`; `limit`: `number`; `offset`: `number`; `source`: `string`; \}\>

Defined in: [src/lib/cache/cached-user-fetchers.ts:135](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-user-fetchers.ts#L135)

Get following feed posts (user-specific)
Uses 'use cache: private' for personalized feed caching
Cache tag: 'posts:following' for granular invalidation
Cache life: 30 seconds - following feed updates frequently

## Parameters

### userId

`string`

### limit

`number` = `100`

### offset

`number` = `0`

## Returns

`Promise`\<\{ `success`: `boolean`; `posts`: `object`[]; `total`: `number`; `limit`: `number`; `offset`: `number`; `source`: `string`; \}\>
