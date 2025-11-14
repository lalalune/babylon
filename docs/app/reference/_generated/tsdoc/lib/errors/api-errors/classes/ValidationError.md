[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / ValidationError

# Class: ValidationError

Defined in: [src/lib/errors/api-errors.ts:79](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L79)

Unprocessable Entity Error (422)

## Extends

- [`ApiError`](ApiError.md)

## Constructors

### Constructor

> **new ValidationError**(`message`, `errors?`, `code?`): `ValidationError`

Defined in: [src/lib/errors/api-errors.ts:80](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L80)

#### Parameters

##### message

`string`

##### errors?

`Record`\<`string`, `string`[]\>

##### code?

`string`

#### Returns

`ValidationError`

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

### errors?

> `optional` **errors**: `Record`\<`string`, `string`[]\>

Defined in: [src/lib/errors/api-errors.ts:82](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L82)
