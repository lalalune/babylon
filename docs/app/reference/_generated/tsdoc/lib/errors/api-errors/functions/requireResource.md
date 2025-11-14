[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / requireResource

# Function: requireResource()

> **requireResource**\<`T`\>(`resource`, `name`): `asserts resource is T`

Defined in: [src/lib/errors/api-errors.ts:310](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L310)

Assert resource exists

## Type Parameters

### T

`T`

## Parameters

### resource

Resource to check

`T` | `null` | `undefined`

### name

`string` = `'Resource'`

Resource name for error message

## Returns

`asserts resource is T`

## Throws

NotFoundError if resource is null/undefined
