[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/prisma-retry](../README.md) / withRetry

# Function: withRetry()

> **withRetry**\<`T`\>(`operation`, `operationName`, `options`): `Promise`\<`T`\>

Defined in: [src/lib/prisma-retry.ts:133](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prisma-retry.ts#L133)

Execute operation with retry logic

## Type Parameters

### T

`T`

## Parameters

### operation

() => `Promise`\<`T`\>

### operationName

`string`

### options

[`RetryOptions`](../interfaces/RetryOptions.md) = `{}`

## Returns

`Promise`\<`T`\>
