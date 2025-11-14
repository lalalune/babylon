[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/agent0.errors](../README.md) / Agent0RateLimitError

# Class: Agent0RateLimitError

Defined in: [src/lib/errors/agent0.errors.ts:214](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L214)

Error for Agent0 rate limiting

## Extends

- [`RateLimitError`](../../base.errors/classes/RateLimitError.md)

## Constructors

### Constructor

> **new Agent0RateLimitError**(`retryAfter?`): `Agent0RateLimitError`

Defined in: [src/lib/errors/agent0.errors.ts:215](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L215)

#### Parameters

##### retryAfter?

`number`

#### Returns

`Agent0RateLimitError`

#### Overrides

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`constructor`](../../base.errors/classes/RateLimitError.md#constructor)

## Methods

### toJSON()

> **toJSON**(): `object`

Defined in: [src/lib/errors/base.errors.ts:35](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L35)

Convert error to JSON for logging and API responses

#### Returns

`object`

##### name

> **name**: `string`

##### message

> **message**: `string`

##### code

> **code**: `string`

##### statusCode

> **statusCode**: `number`

##### timestamp

> **timestamp**: `Date`

##### context

> **context**: `Record`\<`string`, `unknown`\> \| `undefined`

##### stack?

> `optional` **stack**: `string`

#### Inherited from

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`toJSON`](../../base.errors/classes/RateLimitError.md#tojson)

## Properties

### retryAfter?

> `readonly` `optional` **retryAfter**: `number`

Defined in: [src/lib/errors/agent0.errors.ts:216](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L216)

#### Inherited from

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`retryAfter`](../../base.errors/classes/RateLimitError.md#retryafter)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [src/lib/errors/base.errors.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L11)

#### Inherited from

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`timestamp`](../../base.errors/classes/RateLimitError.md#timestamp)

***

### context?

> `readonly` `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/errors/base.errors.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L12)

#### Inherited from

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`context`](../../base.errors/classes/RateLimitError.md#context)

***

### code

> `readonly` **code**: `string`

Defined in: [src/lib/errors/base.errors.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L16)

#### Inherited from

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`code`](../../base.errors/classes/RateLimitError.md#code)

***

### statusCode

> `readonly` **statusCode**: `number` = `500`

Defined in: [src/lib/errors/base.errors.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L17)

#### Inherited from

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`statusCode`](../../base.errors/classes/RateLimitError.md#statuscode)

***

### isOperational

> `readonly` **isOperational**: `boolean` = `true`

Defined in: [src/lib/errors/base.errors.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L18)

#### Inherited from

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`isOperational`](../../base.errors/classes/RateLimitError.md#isoperational)

***

### limit

> `readonly` **limit**: `number`

Defined in: [src/lib/errors/base.errors.ts:163](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L163)

#### Inherited from

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`limit`](../../base.errors/classes/RateLimitError.md#limit)

***

### windowMs

> `readonly` **windowMs**: `number`

Defined in: [src/lib/errors/base.errors.ts:164](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L164)

#### Inherited from

[`RateLimitError`](../../base.errors/classes/RateLimitError.md).[`windowMs`](../../base.errors/classes/RateLimitError.md#windowms)
