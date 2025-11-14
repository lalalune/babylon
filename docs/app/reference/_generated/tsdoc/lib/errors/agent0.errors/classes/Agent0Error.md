[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/agent0.errors](../README.md) / Agent0Error

# Class: Agent0Error

Defined in: [src/lib/errors/agent0.errors.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L12)

Base error class for all Agent0 operations

## Extends

- [`ExternalServiceError`](../../base.errors/classes/ExternalServiceError.md)

## Extended by

- [`Agent0RegistrationError`](Agent0RegistrationError.md)
- [`Agent0FeedbackError`](Agent0FeedbackError.md)
- [`Agent0ReputationError`](Agent0ReputationError.md)
- [`Agent0SearchError`](Agent0SearchError.md)

## Constructors

### Constructor

> **new Agent0Error**(`message`, `operation`, `agent0Code?`, `originalError?`, `originalStatusCode?`): `Agent0Error`

Defined in: [src/lib/errors/agent0.errors.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L16)

#### Parameters

##### message

`string`

##### operation

`"reputation"` | `"search"` | `"register"` | `"feedback"` | `"discovery"`

##### agent0Code?

`string`

##### originalError?

`Error`

##### originalStatusCode?

`number`

#### Returns

`Agent0Error`

#### Overrides

[`ExternalServiceError`](../../base.errors/classes/ExternalServiceError.md).[`constructor`](../../base.errors/classes/ExternalServiceError.md#constructor)

## Methods

### isInstance()

> `static` **isInstance**(`error`): `error is Agent0Error`

Defined in: [src/lib/errors/agent0.errors.ts:43](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L43)

Type guard for Agent0Error

#### Parameters

##### error

`unknown`

#### Returns

`error is Agent0Error`

***

### isRetryable()

> **isRetryable**(): `boolean`

Defined in: [src/lib/errors/agent0.errors.ts:50](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L50)

Check if error is retryable

#### Returns

`boolean`

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

[`ExternalServiceError`](../../base.errors/classes/ExternalServiceError.md).[`toJSON`](../../base.errors/classes/ExternalServiceError.md#tojson)

## Properties

### operation

> `readonly` **operation**: `"reputation"` \| `"search"` \| `"register"` \| `"feedback"` \| `"discovery"`

Defined in: [src/lib/errors/agent0.errors.ts:13](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L13)

***

### agent0Code?

> `readonly` `optional` **agent0Code**: `string`

Defined in: [src/lib/errors/agent0.errors.ts:14](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L14)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [src/lib/errors/base.errors.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L11)

#### Inherited from

[`ExternalServiceError`](../../base.errors/classes/ExternalServiceError.md).[`timestamp`](../../base.errors/classes/ExternalServiceError.md#timestamp)

***

### context?

> `readonly` `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/errors/base.errors.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L12)

#### Inherited from

[`ExternalServiceError`](../../base.errors/classes/ExternalServiceError.md).[`context`](../../base.errors/classes/ExternalServiceError.md#context)

***

### code

> `readonly` **code**: `string`

Defined in: [src/lib/errors/base.errors.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L16)

#### Inherited from

[`BabylonError`](../../base.errors/classes/BabylonError.md).[`code`](../../base.errors/classes/BabylonError.md#code)

***

### statusCode

> `readonly` **statusCode**: `number` = `500`

Defined in: [src/lib/errors/base.errors.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L17)

#### Inherited from

[`BabylonError`](../../base.errors/classes/BabylonError.md).[`statusCode`](../../base.errors/classes/BabylonError.md#statuscode)

***

### isOperational

> `readonly` **isOperational**: `boolean` = `true`

Defined in: [src/lib/errors/base.errors.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L18)

#### Inherited from

[`BabylonError`](../../base.errors/classes/BabylonError.md).[`isOperational`](../../base.errors/classes/BabylonError.md#isoperational)

***

### originalStatusCode?

> `readonly` `optional` **originalStatusCode**: `number`

Defined in: [src/lib/errors/base.errors.ts:146](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L146)

#### Inherited from

[`ExternalServiceError`](../../base.errors/classes/ExternalServiceError.md).[`originalStatusCode`](../../base.errors/classes/ExternalServiceError.md#originalstatuscode)
