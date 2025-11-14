[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/agent0.errors](../README.md) / Agent0DuplicateFeedbackError

# Class: Agent0DuplicateFeedbackError

Defined in: [src/lib/errors/agent0.errors.ts:195](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L195)

Error for duplicate feedback submission attempts

## Extends

- [`Agent0FeedbackError`](Agent0FeedbackError.md)

## Constructors

### Constructor

> **new Agent0DuplicateFeedbackError**(`feedbackId`, `targetAgentId`): `Agent0DuplicateFeedbackError`

Defined in: [src/lib/errors/agent0.errors.ts:196](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L196)

#### Parameters

##### feedbackId

`string`

##### targetAgentId

`number`

#### Returns

`Agent0DuplicateFeedbackError`

#### Overrides

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`constructor`](Agent0FeedbackError.md#constructor)

## Methods

### isRetryable()

> **isRetryable**(): `boolean`

Defined in: [src/lib/errors/agent0.errors.ts:50](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L50)

Check if error is retryable

#### Returns

`boolean`

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`isRetryable`](Agent0FeedbackError.md#isretryable)

***

### isInstance()

> `static` **isInstance**(`error`): `error is Agent0FeedbackError`

Defined in: [src/lib/errors/agent0.errors.ts:129](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L129)

Type guard for Agent0Error

#### Parameters

##### error

`unknown`

#### Returns

`error is Agent0FeedbackError`

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`isInstance`](Agent0FeedbackError.md#isinstance)

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

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`toJSON`](Agent0FeedbackError.md#tojson)

## Properties

### operation

> `readonly` **operation**: `"reputation"` \| `"search"` \| `"register"` \| `"feedback"` \| `"discovery"`

Defined in: [src/lib/errors/agent0.errors.ts:13](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L13)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`operation`](Agent0FeedbackError.md#operation)

***

### agent0Code?

> `readonly` `optional` **agent0Code**: `string`

Defined in: [src/lib/errors/agent0.errors.ts:14](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L14)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`agent0Code`](Agent0FeedbackError.md#agent0code)

***

### feedbackId?

> `readonly` `optional` **feedbackId**: `string`

Defined in: [src/lib/errors/agent0.errors.ts:105](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L105)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`feedbackId`](Agent0FeedbackError.md#feedbackid)

***

### targetAgentId?

> `readonly` `optional` **targetAgentId**: `number`

Defined in: [src/lib/errors/agent0.errors.ts:106](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/agent0.errors.ts#L106)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`targetAgentId`](Agent0FeedbackError.md#targetagentid)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [src/lib/errors/base.errors.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L11)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`timestamp`](Agent0FeedbackError.md#timestamp)

***

### context?

> `readonly` `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/errors/base.errors.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L12)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`context`](Agent0FeedbackError.md#context)

***

### code

> `readonly` **code**: `string`

Defined in: [src/lib/errors/base.errors.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L16)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`code`](Agent0FeedbackError.md#code)

***

### statusCode

> `readonly` **statusCode**: `number` = `500`

Defined in: [src/lib/errors/base.errors.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L17)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`statusCode`](Agent0FeedbackError.md#statuscode)

***

### isOperational

> `readonly` **isOperational**: `boolean` = `true`

Defined in: [src/lib/errors/base.errors.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L18)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`isOperational`](Agent0FeedbackError.md#isoperational)

***

### originalStatusCode?

> `readonly` `optional` **originalStatusCode**: `number`

Defined in: [src/lib/errors/base.errors.ts:146](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L146)

#### Inherited from

[`Agent0FeedbackError`](Agent0FeedbackError.md).[`originalStatusCode`](Agent0FeedbackError.md#originalstatuscode)
