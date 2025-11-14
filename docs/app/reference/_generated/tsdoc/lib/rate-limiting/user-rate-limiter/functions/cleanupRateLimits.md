[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/user-rate-limiter](../README.md) / cleanupRateLimits

# Function: cleanupRateLimits()

> **cleanupRateLimits**(): `void`

Defined in: [src/lib/rate-limiting/user-rate-limiter.ts:188](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/user-rate-limiter.ts#L188)

Cleanup old rate limit records periodically
Should be called periodically (e.g., every 5 minutes) to prevent memory leaks

## Returns

`void`
