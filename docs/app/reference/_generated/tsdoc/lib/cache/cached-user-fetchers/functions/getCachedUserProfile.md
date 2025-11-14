[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-user-fetchers](../README.md) / getCachedUserProfile

# Function: getCachedUserProfile()

> **getCachedUserProfile**(`userId`): `Promise`\<\{ `success`: `boolean`; `user`: \{ `id`: `string`; `walletAddress`: `string` \| `null`; `username`: `string` \| `null`; `displayName`: `string` \| `null`; `bio`: `string` \| `null`; `profileImageUrl`: `string` \| `null`; `isActor`: `boolean`; `profileComplete`: `boolean`; `hasUsername`: `boolean`; `hasBio`: `boolean`; `hasProfileImage`: `boolean`; `onChainRegistered`: `boolean`; `nftTokenId`: `number` \| `null`; `virtualBalance`: `number`; `lifetimePnL`: `number`; `createdAt`: `string`; `stats`: \{ `positions`: `number`; `comments`: `number`; `reactions`: `number`; `followers`: `number`; `following`: `number`; \}; \}; \} \| \{ `success`: `boolean`; `user`: `null`; \}\>

Defined in: [src/lib/cache/cached-user-fetchers.ts:325](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-user-fetchers.ts#L325)

Get user profile (shared, but user-specific data)
Uses 'use cache: remote' for dynamic context caching
Cache tag: 'profile' for granular invalidation
Cache life: 5 minutes (300 seconds) - profiles change infrequently

## Parameters

### userId

`string`

## Returns

`Promise`\<\{ `success`: `boolean`; `user`: \{ `id`: `string`; `walletAddress`: `string` \| `null`; `username`: `string` \| `null`; `displayName`: `string` \| `null`; `bio`: `string` \| `null`; `profileImageUrl`: `string` \| `null`; `isActor`: `boolean`; `profileComplete`: `boolean`; `hasUsername`: `boolean`; `hasBio`: `boolean`; `hasProfileImage`: `boolean`; `onChainRegistered`: `boolean`; `nftTokenId`: `number` \| `null`; `virtualBalance`: `number`; `lifetimePnL`: `number`; `createdAt`: `string`; `stats`: \{ `positions`: `number`; `comments`: `number`; `reactions`: `number`; `followers`: `number`; `following`: `number`; \}; \}; \} \| \{ `success`: `boolean`; `user`: `null`; \}\>
