[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/error-handler](../README.md) / asyncHandler

# Function: asyncHandler()

> **asyncHandler**\<`TContext`\>(`setup?`, `handler?`, `teardown?`): (`req`, `context?`) => `Promise`\<`NextResponse`\<`unknown`\>\>

Defined in: [src/lib/errors/error-handler.ts:292](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/error-handler.ts#L292)

Async wrapper for route handlers with error boundaries
Useful for handlers that need setup or teardown

## Type Parameters

### TContext

`TContext` *extends* [`RouteContext`](../interfaces/RouteContext.md) = [`RouteContext`](../interfaces/RouteContext.md)

## Parameters

### setup?

() => `Promise`\<`void`\>

### handler?

(`req`, `context?`) => `Promise`\<`NextResponse`\<`unknown`\>\>

### teardown?

() => `Promise`\<`void`\>

## Returns

> (`req`, `context?`): `Promise`\<`NextResponse`\<`unknown`\>\>

### Parameters

#### req

`NextRequest`

#### context?

`TContext`

### Returns

`Promise`\<`NextResponse`\<`unknown`\>\>
