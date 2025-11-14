[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / validateRequestBody

# Function: validateRequestBody()

> **validateRequestBody**\<`T`\>(`request`, `schema`): `Promise`\<`output`\<`T`\>\>

Defined in: [src/lib/errors/api-errors.ts:243](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L243)

Validate request body against Zod schema

## Type Parameters

### T

`T` *extends* `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

## Parameters

### request

`Request`

Request object

### schema

`T`

Zod schema

## Returns

`Promise`\<`output`\<`T`\>\>

Validated data

## Throws

ValidationError if validation fails
