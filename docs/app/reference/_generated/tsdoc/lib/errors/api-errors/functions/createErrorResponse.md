[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / createErrorResponse

# Function: createErrorResponse()

> **createErrorResponse**(`error`, `request?`): `NextResponse`\<[`ErrorResponse`](../interfaces/ErrorResponse.md)\>

Defined in: [src/lib/errors/api-errors.ts:144](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L144)

Create standardized error response

## Parameters

### error

`unknown`

Error object

### request?

`Request`

Optional request object for path logging

## Returns

`NextResponse`\<[`ErrorResponse`](../interfaces/ErrorResponse.md)\>

NextResponse with error details
