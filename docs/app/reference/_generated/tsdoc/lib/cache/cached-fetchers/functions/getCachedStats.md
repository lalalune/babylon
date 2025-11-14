[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cached-fetchers](../README.md) / getCachedStats

# Function: getCachedStats()

> **getCachedStats**(): `Promise`\<\{ `success`: `boolean`; `stats`: \{ `totalPosts`: `number`; `totalQuestions`: `number`; `activeQuestions`: `number`; `totalOrganizations`: `number`; `totalActors`: `number`; `currentDay`: `number`; `isRunning`: `boolean`; \}; `engineStatus`: `Promise`\<\{ `isRunning`: `boolean`; `initialized`: `boolean`; `currentDay`: `number`; `currentDate`: `string` \| `undefined`; `speed`: `number`; `lastTickAt`: `string` \| `undefined`; \}\>; \} \| \{ `success`: `boolean`; `stats`: `null`; `engineStatus`: `null`; \}\>

Defined in: [src/lib/cache/cached-fetchers.ts:169](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cached-fetchers.ts#L169)

Get prediction market stats (shared across all users)
Uses 'use cache' for build-time prerendering
Cache tag: 'stats' for granular invalidation
Cache life: 1 minute (60 seconds) - stats change frequently

## Returns

`Promise`\<\{ `success`: `boolean`; `stats`: \{ `totalPosts`: `number`; `totalQuestions`: `number`; `activeQuestions`: `number`; `totalOrganizations`: `number`; `totalActors`: `number`; `currentDay`: `number`; `isRunning`: `boolean`; \}; `engineStatus`: `Promise`\<\{ `isRunning`: `boolean`; `initialized`: `boolean`; `currentDay`: `number`; `currentDate`: `string` \| `undefined`; `speed`: `number`; `lastTickAt`: `string` \| `undefined`; \}\>; \} \| \{ `success`: `boolean`; `stats`: `null`; `engineStatus`: `null`; \}\>
