[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/error-handler](../README.md) / RouteContext

# Interface: RouteContext

Defined in: [src/lib/errors/error-handler.ts:247](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/error-handler.ts#L247)

Route handler context type for Next.js API routes
Supports both sync and async (Promise) params for Next.js 14+

## Properties

### params?

> `optional` **params**: `Record`\<`string`, `string` \| `string`[]\> \| `Promise`\<`Record`\<`string`, `string` \| `string`[]\>\>

Defined in: [src/lib/errors/error-handler.ts:248](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/error-handler.ts#L248)
