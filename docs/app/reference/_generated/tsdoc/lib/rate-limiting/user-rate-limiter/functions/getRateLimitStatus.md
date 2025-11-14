[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/user-rate-limiter](../README.md) / getRateLimitStatus

# Function: getRateLimitStatus()

> **getRateLimitStatus**(`userId`, `config`): `object`

Defined in: [src/lib/rate-limiting/user-rate-limiter.ts:155](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/user-rate-limiter.ts#L155)

Get current rate limit status for a user and action

## Parameters

### userId

`string`

### config

`RateLimitConfig`

## Returns

`object`

### count

> **count**: `number`

### remaining

> **remaining**: `number`

### resetAt

> **resetAt**: `Date`
