[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/retry](../README.md) / retryIfRetryable

# Function: retryIfRetryable()

> **retryIfRetryable**\<`T`\>(`operation`, `options`): `Promise`\<`T`\>

Defined in: [src/lib/retry.ts:51](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/retry.ts#L51)

Retry an async operation if it fails with a retryable error

## Type Parameters

### T

`T`

## Parameters

### operation

() => `Promise`\<`T`\>

### options

`RetryOptions` = `{}`

## Returns

`Promise`\<`T`\>
