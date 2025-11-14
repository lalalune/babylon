[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-user-fetchers](../README.md) / getCachedUserBalance

# Function: getCachedUserBalance()

> **getCachedUserBalance**(`userId`): `Promise`\<\{ `success`: `boolean`; `balance`: `number`; `totalDeposited`: `number`; `totalWithdrawn`: `number`; `lifetimePnL`: `number`; \}\>

Defined in: [src/lib/cache/cached-user-fetchers.ts:275](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-user-fetchers.ts#L275)

Get user balance (user-specific)
Uses 'use cache: private' for personalized balance caching
Cache tag: 'balance' for granular invalidation
Cache life: 15 seconds - balance changes after trades

## Parameters

### userId

`string`

## Returns

`Promise`\<\{ `success`: `boolean`; `balance`: `number`; `totalDeposited`: `number`; `totalWithdrawn`: `number`; `lifetimePnL`: `number`; \}\>
