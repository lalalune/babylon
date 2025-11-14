[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/cache-service](../README.md) / getCacheStats

# Function: getCacheStats()

> **getCacheStats**(): `object`

Defined in: [src/lib/cache-service.ts:275](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache-service.ts#L275)

Get cache statistics (memory cache only)

## Returns

`object`

### totalEntries

> **totalEntries**: `number` = `memoryCache.size`

### activeEntries

> **activeEntries**: `number`

### expiredEntries

> **expiredEntries**: `number`

### redisAvailable

> **redisAvailable**: `boolean` = `!!redis`

### redisType

> **redisType**: `"upstash"` \| `"standard"` \| `null` = `redisClientType`
