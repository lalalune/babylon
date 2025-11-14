[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/a2a/utils/rate-limiter](../README.md) / RateLimiter

# Class: RateLimiter

Defined in: [src/lib/a2a/utils/rate-limiter.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/utils/rate-limiter.ts#L11)

## Constructors

### Constructor

> **new RateLimiter**(`messagesPerMinute`): `RateLimiter`

Defined in: [src/lib/a2a/utils/rate-limiter.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/utils/rate-limiter.ts#L17)

#### Parameters

##### messagesPerMinute

`number`

#### Returns

`RateLimiter`

## Methods

### checkLimit()

> **checkLimit**(`agentId`): `boolean`

Defined in: [src/lib/a2a/utils/rate-limiter.ts:25](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/utils/rate-limiter.ts#L25)

Check if agent can send a message (has tokens available)

#### Parameters

##### agentId

`string`

#### Returns

`boolean`

***

### reset()

> **reset**(`agentId`): `void`

Defined in: [src/lib/a2a/utils/rate-limiter.ts:73](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/utils/rate-limiter.ts#L73)

Reset rate limit for an agent (useful for testing)

#### Parameters

##### agentId

`string`

#### Returns

`void`

***

### getTokens()

> **getTokens**(`agentId`): `number`

Defined in: [src/lib/a2a/utils/rate-limiter.ts:80](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/utils/rate-limiter.ts#L80)

Get current token count for agent

#### Parameters

##### agentId

`string`

#### Returns

`number`

***

### clear()

> **clear**(): `void`

Defined in: [src/lib/a2a/utils/rate-limiter.ts:89](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/utils/rate-limiter.ts#L89)

Clear all rate limit data

#### Returns

`void`
