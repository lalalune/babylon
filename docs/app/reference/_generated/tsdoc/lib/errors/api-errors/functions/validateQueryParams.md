[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / validateQueryParams

# Function: validateQueryParams()

> **validateQueryParams**\<`T`\>(`searchParams`, `schema`): `output`\<`T`\>

Defined in: [src/lib/errors/api-errors.ts:267](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L267)

Validate query parameters against Zod schema

## Type Parameters

### T

`T` *extends* `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

## Parameters

### searchParams

`URLSearchParams`

URLSearchParams object

### schema

`T`

Zod schema

## Returns

`output`\<`T`\>

Validated data

## Throws

ValidationError if validation fails
