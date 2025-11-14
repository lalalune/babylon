[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-fetchers](../README.md) / getCachedActor

# Function: getCachedActor()

> **getCachedActor**(`actorId`): `Promise`\<\{ `success`: `boolean`; `actor`: \{ `id`: `string`; `name`: `string`; `description`: `string` \| `null`; `domain`: `string`[]; `personality`: `string` \| `null`; `tier`: `string` \| `null`; `role`: `string` \| `null`; `mood`: `number`; `luck`: `string`; `postStyle`: `string` \| `null`; \}; \} \| \{ `success`: `boolean`; `actor`: `null`; \}\>

Defined in: [src/lib/cache/cached-fetchers.ts:547](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-fetchers.ts#L547)

Get actor information (shared, but dynamic per actor)
Uses 'use cache: remote' for dynamic context caching
Cache tag: 'actors' for granular invalidation
Cache life: 5 minutes (300 seconds) - actor info changes infrequently

## Parameters

### actorId

`string`

## Returns

`Promise`\<\{ `success`: `boolean`; `actor`: \{ `id`: `string`; `name`: `string`; `description`: `string` \| `null`; `domain`: `string`[]; `personality`: `string` \| `null`; `tier`: `string` \| `null`; `role`: `string` \| `null`; `mood`: `number`; `luck`: `string`; `postStyle`: `string` \| `null`; \}; \} \| \{ `success`: `boolean`; `actor`: `null`; \}\>
