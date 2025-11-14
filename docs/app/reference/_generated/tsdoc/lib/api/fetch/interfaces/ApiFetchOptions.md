[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/api/fetch](../README.md) / ApiFetchOptions

# Interface: ApiFetchOptions

Defined in: [src/lib/api/fetch.ts:1](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/api/fetch.ts#L1)

## Extends

- `RequestInit`

## Properties

### auth?

> `optional` **auth**: `boolean`

Defined in: [src/lib/api/fetch.ts:5](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/api/fetch.ts#L5)

When true (default), the current Privy access token is attached if available.

***

### autoRetryOn401?

> `optional` **autoRetryOn401**: `boolean`

Defined in: [src/lib/api/fetch.ts:9](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/api/fetch.ts#L9)

When true (default), automatically retry with a fresh token if the request fails with 401.
