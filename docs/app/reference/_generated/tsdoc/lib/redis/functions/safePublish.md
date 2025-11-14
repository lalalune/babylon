[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/redis](../README.md) / safePublish

# Function: safePublish()

> **safePublish**(`channel`, `message`): `Promise`\<`boolean`\>

Defined in: [src/lib/redis.ts:84](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/redis.ts#L84)

Safely publish to Redis (no-op if not available)
Works with both Upstash and standard Redis

## Parameters

### channel

`string`

### message

`string`

## Returns

`Promise`\<`boolean`\>
