[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / withErrorHandling

# Function: withErrorHandling()

> **withErrorHandling**\<`T`\>(`handler`): (...`args`) => `Promise`\<`NextResponse`\<`unknown`\>\>

Defined in: [src/lib/errors/api-errors.ts:223](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L223)

Async error handler wrapper for API routes

## Type Parameters

### T

`T` *extends* `unknown`[]

## Parameters

### handler

(...`args`) => `Promise`\<`NextResponse`\<`unknown`\>\>

Async API route handler

## Returns

Wrapped handler with error handling

> (...`args`): `Promise`\<`NextResponse`\<`unknown`\>\>

### Parameters

#### args

...`T`

### Returns

`Promise`\<`NextResponse`\<`unknown`\>\>
