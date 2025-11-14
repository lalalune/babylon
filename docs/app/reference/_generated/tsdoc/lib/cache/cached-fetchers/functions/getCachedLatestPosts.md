[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-fetchers](../README.md) / getCachedLatestPosts

# Function: getCachedLatestPosts()

> **getCachedLatestPosts**(`limit`, `offset`, `actorId?`): `Promise`\<\{ `success`: `boolean`; `posts`: `object`[]; `total`: `number`; `limit`: `number`; `offset`: `number`; `source`: `string`; \} \| \{ `success`: `boolean`; `posts`: `object`[]; `total`: `number`; `limit`: `number`; `offset`: `number`; \}\>

Defined in: [src/lib/cache/cached-fetchers.ts:309](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-fetchers.ts#L309)

Get latest posts (shared feed)
Uses 'use cache: remote' for dynamic context caching
Cache tag: 'posts:latest' for granular invalidation
Cache life: 30 seconds - posts are very dynamic

## Parameters

### limit

`number` = `100`

### offset

`number` = `0`

### actorId?

`string`

## Returns

`Promise`\<\{ `success`: `boolean`; `posts`: `object`[]; `total`: `number`; `limit`: `number`; `offset`: `number`; `source`: `string`; \} \| \{ `success`: `boolean`; `posts`: `object`[]; `total`: `number`; `limit`: `number`; `offset`: `number`; \}\>
