[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / ApiError

# Class: ApiError

Defined in: [src/lib/errors/api-errors.ts:15](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L15)

Base API Error class

## Extends

- `Error`

## Extended by

- [`BadRequestError`](BadRequestError.md)
- [`UnauthorizedError`](UnauthorizedError.md)
- [`ForbiddenError`](ForbiddenError.md)
- [`NotFoundError`](NotFoundError.md)
- [`ConflictError`](ConflictError.md)
- [`ValidationError`](ValidationError.md)
- [`RateLimitError`](RateLimitError.md)
- [`InternalServerError`](InternalServerError.md)
- [`ServiceUnavailableError`](ServiceUnavailableError.md)

## Constructors

### Constructor

> **new ApiError**(`message`, `statusCode`, `code?`): `ApiError`

Defined in: [src/lib/errors/api-errors.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L16)

#### Parameters

##### message

`string`

##### statusCode

`number` = `500`

##### code?

`string`

#### Returns

`ApiError`

#### Overrides

`Error.constructor`

## Properties

### statusCode

> **statusCode**: `number` = `500`

Defined in: [src/lib/errors/api-errors.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L18)

***

### code?

> `optional` **code**: `string`

Defined in: [src/lib/errors/api-errors.ts:19](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L19)
