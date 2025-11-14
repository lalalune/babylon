[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / RateLimitError

# Class: RateLimitError

Defined in: [src/lib/errors/api-errors.ts:93](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L93)

Rate Limit Error (429)

## Extends

- [`ApiError`](ApiError.md)

## Constructors

### Constructor

> **new RateLimitError**(`message`, `reset?`, `code?`): `RateLimitError`

Defined in: [src/lib/errors/api-errors.ts:94](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L94)

#### Parameters

##### message

`string` = `'Too many requests'`

##### reset?

`number`

##### code?

`string`

#### Returns

`RateLimitError`

#### Overrides

[`ApiError`](ApiError.md).[`constructor`](ApiError.md#constructor)

## Properties

### statusCode

> **statusCode**: `number` = `500`

Defined in: [src/lib/errors/api-errors.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L18)

#### Inherited from

[`ApiError`](ApiError.md).[`statusCode`](ApiError.md#statuscode)

***

### code?

> `optional` **code**: `string`

Defined in: [src/lib/errors/api-errors.ts:19](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L19)

#### Inherited from

[`ApiError`](ApiError.md).[`code`](ApiError.md#code)

***

### reset?

> `optional` **reset**: `number`

Defined in: [src/lib/errors/api-errors.ts:96](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L96)
