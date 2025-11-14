[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/redis](../README.md) / safePoll

# Function: safePoll()

> **safePoll**(`channel`, `count`): `Promise`\<`string`[]\>

Defined in: [src/lib/redis.ts:101](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/redis.ts#L101)

Safely poll Redis for messages (returns empty array if not available)
Works with both Upstash and standard Redis

## Parameters

### channel

`string`

### count

`number` = `10`

## Returns

`Promise`\<`string`[]\>
