[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/error-handler](../README.md) / withErrorHandling

# Function: withErrorHandling()

## Call Signature

> **withErrorHandling**(`handler`): (`req`) => `Promise`\<`NextResponse`\<`unknown`\>\>

Defined in: [src/lib/errors/error-handler.ts:257](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/error-handler.ts#L257)

Higher-order function wrapper for API routes with error handling

### Parameters

#### handler

(`req`) => `NextResponse`\<`unknown`\> \| `Promise`\<`NextResponse`\<`unknown`\>\>

The async route handler function

### Returns

A wrapped handler with automatic error handling

> (`req`): `Promise`\<`NextResponse`\<`unknown`\>\>

#### Parameters

##### req

`NextRequest`

#### Returns

`Promise`\<`NextResponse`\<`unknown`\>\>

## Call Signature

> **withErrorHandling**\<`TContext`\>(`handler`): (`req`, `context`) => `Promise`\<`NextResponse`\<`unknown`\>\>

Defined in: [src/lib/errors/error-handler.ts:262](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/error-handler.ts#L262)

Higher-order function wrapper for API routes with error handling

### Type Parameters

#### TContext

`TContext` *extends* [`RouteContext`](../interfaces/RouteContext.md) = [`RouteContext`](../interfaces/RouteContext.md)

### Parameters

#### handler

(`req`, `context`) => `NextResponse`\<`unknown`\> \| `Promise`\<`NextResponse`\<`unknown`\>\>

The async route handler function

### Returns

A wrapped handler with automatic error handling

> (`req`, `context`): `Promise`\<`NextResponse`\<`unknown`\>\>

#### Parameters

##### req

`NextRequest`

##### context

`TContext`

#### Returns

`Promise`\<`NextResponse`\<`unknown`\>\>
