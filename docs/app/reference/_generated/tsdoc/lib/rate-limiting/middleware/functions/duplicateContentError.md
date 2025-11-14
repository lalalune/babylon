[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/middleware](../README.md) / duplicateContentError

# Function: duplicateContentError()

> **duplicateContentError**(`lastPostedAt?`): `NextResponse`\<\{ `success`: `boolean`; `error`: `string`; `message`: `string`; `lastPostedAt`: `string` \| `undefined`; \}\>

Defined in: [src/lib/rate-limiting/middleware.ts:38](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/middleware.ts#L38)

Error response for duplicate content

## Parameters

### lastPostedAt?

`Date`

## Returns

`NextResponse`\<\{ `success`: `boolean`; `error`: `string`; `message`: `string`; `lastPostedAt`: `string` \| `undefined`; \}\>
