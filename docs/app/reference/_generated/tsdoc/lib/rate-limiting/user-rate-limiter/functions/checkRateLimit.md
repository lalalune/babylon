[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/user-rate-limiter](../README.md) / checkRateLimit

# Function: checkRateLimit()

> **checkRateLimit**(`userId`, `config`): `object`

Defined in: [src/lib/rate-limiting/user-rate-limiter.ts:69](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/user-rate-limiter.ts#L69)

Check if user has exceeded rate limit for a specific action
Uses sliding window algorithm for accurate rate limiting

## Parameters

### userId

`string`

### config

`RateLimitConfig`

## Returns

`object`

### allowed

> **allowed**: `boolean`

### retryAfter?

> `optional` **retryAfter**: `number`

### remaining?

> `optional` **remaining**: `number`
