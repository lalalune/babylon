[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/sentry/server-actions](../README.md) / wrapServerActionWithSentry

# Function: wrapServerActionWithSentry()

> **wrapServerActionWithSentry**\<`T`, `R`\>(`actionName`, `action`): (...`args`) => `Promise`\<`R`\>

Defined in: [src/lib/sentry/server-actions.ts:27](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/sentry/server-actions.ts#L27)

Wrap a server action with Sentry error tracking and performance monitoring

## Type Parameters

### T

`T` *extends* `unknown`[]

### R

`R`

## Parameters

### actionName

`string`

### action

(...`args`) => `Promise`\<`R`\>

## Returns

> (...`args`): `Promise`\<`R`\>

### Parameters

#### args

...`T`

### Returns

`Promise`\<`R`\>
