[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/cache/cache-polyfill](../README.md) / cacheTag

# Function: cacheTag()

> **cacheTag**(...`tags`): `void`

Defined in: [src/lib/cache/cache-polyfill.ts:48](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/cache/cache-polyfill.ts#L48)

Polyfill for Next.js 16+ cacheTag function
Associates cache tags with the current cache context

In Next.js 15, we track tags in AsyncLocalStorage so they can be
used for revalidation via revalidateTag()

## Parameters

### tags

...`string`[]

One or more cache tag strings

## Returns

`void`
