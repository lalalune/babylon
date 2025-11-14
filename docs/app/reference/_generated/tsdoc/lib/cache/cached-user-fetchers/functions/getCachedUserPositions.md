[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-user-fetchers](../README.md) / getCachedUserPositions

# Function: getCachedUserPositions()

> **getCachedUserPositions**(`userId`): `Promise`\<\{ `success`: `boolean`; `perpetuals`: \{ `positions`: `object`[]; `stats`: \{ `totalPositions`: `number`; `totalPnL`: `number`; `totalFunding`: `number`; \}; \}; `predictions`: \{ `positions`: `object`[]; `stats`: \{ `totalPositions`: `number`; \}; \}; `timestamp`: `string`; \}\>

Defined in: [src/lib/cache/cached-user-fetchers.ts:23](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-user-fetchers.ts#L23)

Get user positions (perpetuals and predictions)
Uses 'use cache: private' for user-specific caching
Cache tag: 'positions' for granular invalidation
Cache life: 30 seconds - positions change frequently during trading

## Parameters

### userId

`string`

## Returns

`Promise`\<\{ `success`: `boolean`; `perpetuals`: \{ `positions`: `object`[]; `stats`: \{ `totalPositions`: `number`; `totalPnL`: `number`; `totalFunding`: `number`; \}; \}; `predictions`: \{ `positions`: `object`[]; `stats`: \{ `totalPositions`: `number`; \}; \}; `timestamp`: `string`; \}\>
