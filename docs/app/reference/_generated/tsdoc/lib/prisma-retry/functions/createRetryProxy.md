[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/prisma-retry](../README.md) / createRetryProxy

# Function: createRetryProxy()

> **createRetryProxy**\<`T`\>(`prismaClient`, `defaultOptions?`): `T`

Defined in: [src/lib/prisma-retry.ts:207](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prisma-retry.ts#L207)

Create a retry-wrapped Prisma client proxy

Usage:
  const prismaWithRetry = createRetryProxy(prisma);
  const users = await prismaWithRetry.user.findMany();

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### prismaClient

`T`

### defaultOptions?

[`RetryOptions`](../interfaces/RetryOptions.md)

## Returns

`T`
