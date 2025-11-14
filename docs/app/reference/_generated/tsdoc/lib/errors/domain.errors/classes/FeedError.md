[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/domain.errors](../README.md) / FeedError

# Class: FeedError

Defined in: [src/lib/errors/domain.errors.ts:244](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L244)

Feed error for social feed operations

## Extends

- [`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md)

## Constructors

### Constructor

> **new FeedError**(`message`, `feedId`, `reason`): `FeedError`

Defined in: [src/lib/errors/domain.errors.ts:245](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L245)

#### Parameters

##### message

`string`

##### feedId

`string`

##### reason

`"GENERATION_FAILED"` | `"RATE_LIMITED"` | `"INVALID_CONTENT"` | `"MODERATION_FAILED"`

#### Returns

`FeedError`

#### Overrides

[`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md).[`constructor`](../../base.errors/classes/BusinessLogicError.md#constructor)

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

[`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md).[`toJSON`](../../base.errors/classes/BusinessLogicError.md#tojson)

## Properties

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [src/lib/errors/base.errors.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L11)

#### Inherited from

[`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md).[`timestamp`](../../base.errors/classes/BusinessLogicError.md#timestamp)

***

### context?

> `readonly` `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/errors/base.errors.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L12)

#### Inherited from

[`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md).[`context`](../../base.errors/classes/BusinessLogicError.md#context)

***

### code

> `readonly` **code**: `string`

Defined in: [src/lib/errors/base.errors.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L16)

#### Inherited from

[`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md).[`code`](../../base.errors/classes/BusinessLogicError.md#code)

***

### statusCode

> `readonly` **statusCode**: `number` = `500`

Defined in: [src/lib/errors/base.errors.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L17)

#### Inherited from

[`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md).[`statusCode`](../../base.errors/classes/BusinessLogicError.md#statuscode)

***

### isOperational

> `readonly` **isOperational**: `boolean` = `true`

Defined in: [src/lib/errors/base.errors.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L18)

#### Inherited from

[`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md).[`isOperational`](../../base.errors/classes/BusinessLogicError.md#isoperational)

***

### feedId

> `readonly` **feedId**: `string`

Defined in: [src/lib/errors/domain.errors.ts:247](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L247)

***

### reason

> `readonly` **reason**: `"GENERATION_FAILED"` \| `"RATE_LIMITED"` \| `"INVALID_CONTENT"` \| `"MODERATION_FAILED"`

Defined in: [src/lib/errors/domain.errors.ts:248](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L248)
