[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/agent0.errors](../README.md) / Agent0ReputationError

# Class: Agent0ReputationError

Defined in: [src/lib/errors/agent0.errors.ts:137](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L137)

Error for Agent0 reputation query failures

## Extends

- [`Agent0Error`](Agent0Error.md)

## Constructors

### Constructor

> **new Agent0ReputationError**(`message`, `tokenId?`, `agent0Code?`, `originalError?`, `originalStatusCode?`): `Agent0ReputationError`

Defined in: [src/lib/errors/agent0.errors.ts:140](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L140)

#### Parameters

##### message

`string`

##### tokenId?

`number`

##### agent0Code?

`string`

##### originalError?

`Error`

##### originalStatusCode?

`number`

#### Returns

`Agent0ReputationError`

#### Overrides

[`Agent0Error`](Agent0Error.md).[`constructor`](Agent0Error.md#constructor)

## Methods

### isRetryable()

> **isRetryable**(): `boolean`

Defined in: [src/lib/errors/agent0.errors.ts:50](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L50)

Check if error is retryable

#### Returns

`boolean`

#### Inherited from

[`Agent0Error`](Agent0Error.md).[`isRetryable`](Agent0Error.md#isretryable)

***

### isInstance()

> `static` **isInstance**(`error`): `error is Agent0ReputationError`

Defined in: [src/lib/errors/agent0.errors.ts:158](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L158)

Type guard for Agent0Error

#### Parameters

##### error

`unknown`

#### Returns

`error is Agent0ReputationError`

#### Overrides

[`Agent0Error`](Agent0Error.md).[`isInstance`](Agent0Error.md#isinstance)

***

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

[`Agent0Error`](Agent0Error.md).[`toJSON`](Agent0Error.md#tojson)

## Properties

### operation

> `readonly` **operation**: `"reputation"` \| `"search"` \| `"register"` \| `"feedback"` \| `"discovery"`

Defined in: [src/lib/errors/agent0.errors.ts:13](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L13)

#### Inherited from

[`Agent0Error`](Agent0Error.md).[`operation`](Agent0Error.md#operation)

***

### agent0Code?

> `readonly` `optional` **agent0Code**: `string`

Defined in: [src/lib/errors/agent0.errors.ts:14](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L14)

#### Inherited from

[`Agent0Error`](Agent0Error.md).[`agent0Code`](Agent0Error.md#agent0code)

***

### tokenId?

> `readonly` `optional` **tokenId**: `number`

Defined in: [src/lib/errors/agent0.errors.ts:138](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L138)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [src/lib/errors/base.errors.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L11)

#### Inherited from

[`Agent0Error`](Agent0Error.md).[`timestamp`](Agent0Error.md#timestamp)

***

### context?

> `readonly` `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/errors/base.errors.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L12)

#### Inherited from

[`Agent0Error`](Agent0Error.md).[`context`](Agent0Error.md#context)

***

### code

> `readonly` **code**: `string`

Defined in: [src/lib/errors/base.errors.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L16)

#### Inherited from

[`Agent0Error`](Agent0Error.md).[`code`](Agent0Error.md#code)

***

### statusCode

> `readonly` **statusCode**: `number` = `500`

Defined in: [src/lib/errors/base.errors.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L17)

#### Inherited from

[`Agent0Error`](Agent0Error.md).[`statusCode`](Agent0Error.md#statuscode)

***

### isOperational

> `readonly` **isOperational**: `boolean` = `true`

Defined in: [src/lib/errors/base.errors.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L18)

#### Inherited from

[`Agent0Error`](Agent0Error.md).[`isOperational`](Agent0Error.md#isoperational)

***

### originalStatusCode?

> `readonly` `optional` **originalStatusCode**: `number`

Defined in: [src/lib/errors/base.errors.ts:146](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L146)

#### Inherited from

[`Agent0Error`](Agent0Error.md).[`originalStatusCode`](Agent0Error.md#originalstatuscode)
