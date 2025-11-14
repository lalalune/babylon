[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/retry](../README.md) / retryWithCondition

# Function: retryWithCondition()

> **retryWithCondition**\<`T`\>(`operation`, `shouldRetry`, `options`): `Promise`\<`T`\>

Defined in: [src/lib/retry.ts:97](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/retry.ts#L97)

Retry with custom retry condition

## Type Parameters

### T

`T`

## Parameters

### operation

() => `Promise`\<`T`\>

### shouldRetry

(`error`) => `boolean`

### options

`RetryOptions` = `{}`

## Returns

`Promise`\<`T`\>
