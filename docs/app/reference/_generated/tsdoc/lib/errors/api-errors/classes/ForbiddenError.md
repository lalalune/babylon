[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / ForbiddenError

# Class: ForbiddenError

Defined in: [src/lib/errors/api-errors.ts:49](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L49)

Forbidden Error (403)

## Extends

- [`ApiError`](ApiError.md)

## Constructors

### Constructor

> **new ForbiddenError**(`message`, `code?`): `ForbiddenError`

Defined in: [src/lib/errors/api-errors.ts:50](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L50)

#### Parameters

##### message

`string` = `'Forbidden'`

##### code?

`string`

#### Returns

`ForbiddenError`

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
