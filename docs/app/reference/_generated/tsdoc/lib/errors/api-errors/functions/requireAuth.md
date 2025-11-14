[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / requireAuth

# Function: requireAuth()

> **requireAuth**(`userId`): `asserts userId is string`

Defined in: [src/lib/errors/api-errors.ts:281](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L281)

Assert user is authenticated

## Parameters

### userId

User ID from session

`string` | `null` | `undefined`

## Returns

`asserts userId is string`

## Throws

UnauthorizedError if not authenticated
