[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-fetchers](../README.md) / getCachedPerpMarkets

# Function: getCachedPerpMarkets()

> **getCachedPerpMarkets**(): `Promise`\<\{ `success`: `boolean`; `markets`: `object`[]; `count`: `number`; \}\>

Defined in: [src/lib/cache/cached-fetchers.ts:57](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-fetchers.ts#L57)

Get perpetual markets data (shared across all users)
Uses 'use cache' for build-time prerendering and runtime caching
Cache tag: 'markets:perps' for granular invalidation
Cache life: 5 minutes (300 seconds)

## Returns

`Promise`\<\{ `success`: `boolean`; `markets`: `object`[]; `count`: `number`; \}\>
