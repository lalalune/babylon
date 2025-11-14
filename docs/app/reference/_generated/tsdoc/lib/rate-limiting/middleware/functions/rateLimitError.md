[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/middleware](../README.md) / rateLimitError

# Function: rateLimitError()

> **rateLimitError**(`retryAfter?`): `NextResponse`\<\{ `success`: `boolean`; `error`: `string`; `message`: `string`; `retryAfter`: `number` \| `undefined`; \}\>

Defined in: [src/lib/rate-limiting/middleware.ts:15](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/middleware.ts#L15)

Error response for rate limit exceeded

## Parameters

### retryAfter?

`number`

## Returns

`NextResponse`\<\{ `success`: `boolean`; `error`: `string`; `message`: `string`; `retryAfter`: `number` \| `undefined`; \}\>
