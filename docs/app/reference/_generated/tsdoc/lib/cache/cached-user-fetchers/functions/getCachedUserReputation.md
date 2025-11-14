[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-user-fetchers](../README.md) / getCachedUserReputation

# Function: getCachedUserReputation()

> **getCachedUserReputation**(`userId`): `Promise`\<\{ `success`: `boolean`; `reputation`: \{ `onChain`: `number`; `base`: `number`; `enhanced`: `number`; `participationBonus`: `number`; `participationScore`: `number`; \}; `stats`: \{ `totalWins`: `number`; `totalLosses`: `number`; `winRate`: `number`; `totalBets`: `number`; \}; `participation`: \{ `postsCreated`: `number`; `commentsMade`: `number`; `sharesMade`: `number`; `reactionsGiven`: `number`; `marketsParticipated`: `number`; `totalActivity`: `number`; `lastActivityAt`: `string`; \} \| `null`; `hasNft`: `boolean`; `recentActivity`: `object`[]; \} \| \{ `success`: `boolean`; `reputation`: `null`; `stats`: `null`; `participation`: `null`; `hasNft`: `boolean`; `recentActivity`: `never`[]; \}\>

Defined in: [src/lib/cache/cached-user-fetchers.ts:566](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-user-fetchers.ts#L566)

Get user reputation (user-specific)
Uses 'use cache: private' for personalized reputation caching
Cache tag: 'reputation' for granular invalidation
Cache life: 2 minutes (120 seconds) - reputation changes less frequently

## Parameters

### userId

`string`

## Returns

`Promise`\<\{ `success`: `boolean`; `reputation`: \{ `onChain`: `number`; `base`: `number`; `enhanced`: `number`; `participationBonus`: `number`; `participationScore`: `number`; \}; `stats`: \{ `totalWins`: `number`; `totalLosses`: `number`; `winRate`: `number`; `totalBets`: `number`; \}; `participation`: \{ `postsCreated`: `number`; `commentsMade`: `number`; `sharesMade`: `number`; `reactionsGiven`: `number`; `marketsParticipated`: `number`; `totalActivity`: `number`; `lastActivityAt`: `string`; \} \| `null`; `hasNft`: `boolean`; `recentActivity`: `object`[]; \} \| \{ `success`: `boolean`; `reputation`: `null`; `stats`: `null`; `participation`: `null`; `hasNft`: `boolean`; `recentActivity`: `never`[]; \}\>
