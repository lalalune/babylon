[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-fetchers](../README.md) / getCachedMarkets

# Function: getCachedMarkets()

> **getCachedMarkets**(): `Promise`\<\{ `success`: `boolean`; `markets`: `object`[]; `count`: `number`; \}\>

Defined in: [src/lib/cache/cached-fetchers.ts:505](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-fetchers.ts#L505)

Get all prediction markets (shared)
Uses 'use cache' for build-time prerendering
Cache tag: 'markets:list' for granular invalidation
Cache life: 5 minutes (300 seconds)

## Returns

`Promise`\<\{ `success`: `boolean`; `markets`: `object`[]; `count`: `number`; \}\>
