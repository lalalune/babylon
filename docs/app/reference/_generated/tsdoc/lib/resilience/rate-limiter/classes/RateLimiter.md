[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/resilience/rate-limiter](../README.md) / RateLimiter

# Class: RateLimiter

Defined in: [src/lib/resilience/rate-limiter.ts:24](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/rate-limiter.ts#L24)

Token bucket rate limiter

## Constructors

### Constructor

> **new RateLimiter**(`options`): `RateLimiter`

Defined in: [src/lib/resilience/rate-limiter.ts:29](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/rate-limiter.ts#L29)

#### Parameters

##### options

[`RateLimiterOptions`](../interfaces/RateLimiterOptions.md)

#### Returns

`RateLimiter`

## Methods

### tryConsume()

> **tryConsume**(`count`): `Promise`\<`boolean`\>

Defined in: [src/lib/resilience/rate-limiter.ts:64](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/rate-limiter.ts#L64)

Try to consume tokens

#### Parameters

##### count

`number` = `1`

Number of tokens to consume

#### Returns

`Promise`\<`boolean`\>

true if tokens available, false otherwise

***

### consume()

> **consume**(`count`): `Promise`\<`void`\>

Defined in: [src/lib/resilience/rate-limiter.ts:79](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/rate-limiter.ts#L79)

Consume tokens or throw error

#### Parameters

##### count

`number` = `1`

Number of tokens to consume

#### Returns

`Promise`\<`void`\>

***

### getAvailableTokens()

> **getAvailableTokens**(): `number`

Defined in: [src/lib/resilience/rate-limiter.ts:106](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/rate-limiter.ts#L106)

Get current token count

#### Returns

`number`

***

### reset()

> **reset**(): `void`

Defined in: [src/lib/resilience/rate-limiter.ts:114](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/rate-limiter.ts#L114)

Reset rate limiter (refill all tokens)

#### Returns

`void`
