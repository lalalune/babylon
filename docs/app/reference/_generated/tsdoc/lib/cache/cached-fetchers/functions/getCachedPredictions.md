[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-fetchers](../README.md) / getCachedPredictions

# Function: getCachedPredictions()

> **getCachedPredictions**(`userId?`, `timeframe?`): `Promise`\<\{ `success`: `boolean`; `questions`: `object`[]; `count`: `number`; \}\>

Defined in: [src/lib/cache/cached-fetchers.ts:210](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-fetchers.ts#L210)

Get active prediction questions (shared, but can include user positions)
Uses 'use cache: remote' for dynamic context caching
Cache tag: 'markets:predictions' for granular invalidation
Cache life: 2 minutes (120 seconds) - predictions update frequently

## Parameters

### userId?

`string`

### timeframe?

`string`

## Returns

`Promise`\<\{ `success`: `boolean`; `questions`: `object`[]; `count`: `number`; \}\>
