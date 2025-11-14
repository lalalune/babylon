[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-fetchers](../README.md) / getCachedRegistry

# Function: getCachedRegistry()

> **getCachedRegistry**(`filters`): `Promise`\<\{ `success`: `boolean`; `users`: `object`[]; `pagination`: \{ `total`: `number`; `limit`: `number`; `offset`: `number`; `hasMore`: `boolean`; \}; \}\>

Defined in: [src/lib/cache/cached-fetchers.ts:378](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-fetchers.ts#L378)

Get registry users (shared, but can be filtered)
Uses 'use cache: remote' for dynamic filtering caching
Cache tag: 'registry' for granular invalidation
Cache life: 3 minutes (180 seconds) - registry changes less frequently

## Parameters

### filters

#### onChainOnly?

`boolean`

#### sortBy?

`"username"` \| `"createdAt"` \| `"nftTokenId"`

#### sortOrder?

`"asc"` \| `"desc"`

#### limit?

`number`

#### offset?

`number`

## Returns

`Promise`\<\{ `success`: `boolean`; `users`: `object`[]; `pagination`: \{ `total`: `number`; `limit`: `number`; `offset`: `number`; `hasMore`: `boolean`; \}; \}\>
