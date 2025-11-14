[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / InternalServerError

# Class: InternalServerError

Defined in: [src/lib/errors/api-errors.ts:107](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L107)

Internal Server Error (500)

## Extends

- [`ApiError`](ApiError.md)

## Constructors

### Constructor

> **new InternalServerError**(`message`, `code?`): `InternalServerError`

Defined in: [src/lib/errors/api-errors.ts:108](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L108)

#### Parameters

##### message

`string` = `'Internal server error'`

##### code?

`string`

#### Returns

`InternalServerError`

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
