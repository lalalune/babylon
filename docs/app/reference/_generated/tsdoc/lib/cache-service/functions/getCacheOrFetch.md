[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/cache-service](../README.md) / getCacheOrFetch

# Function: getCacheOrFetch()

> **getCacheOrFetch**\<`T`\>(`key`, `fetchFn`, `options`): `Promise`\<`T`\>

Defined in: [src/lib/cache-service.ts:239](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache-service.ts#L239)

Get or set pattern - fetch from cache or execute function and cache result

## Type Parameters

### T

`T`

## Parameters

### key

`string`

### fetchFn

() => `Promise`\<`T`\>

### options

[`CacheOptions`](../interfaces/CacheOptions.md) = `{}`

## Returns

`Promise`\<`T`\>
