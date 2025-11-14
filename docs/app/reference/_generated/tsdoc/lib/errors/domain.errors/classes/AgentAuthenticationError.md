[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/domain.errors](../README.md) / AgentAuthenticationError

# Class: AgentAuthenticationError

Defined in: [src/lib/errors/domain.errors.ts:85](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L85)

Agent authentication error

## Extends

- [`BabylonError`](../../base.errors/classes/BabylonError.md)

## Constructors

### Constructor

> **new AgentAuthenticationError**(`agentId`, `reason`): `AgentAuthenticationError`

Defined in: [src/lib/errors/domain.errors.ts:86](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L86)

#### Parameters

##### agentId

`string`

##### reason

`"NOT_REGISTERED"` | `"INVALID_SIGNATURE"` | `"EXPIRED_NONCE"` | `"BANNED"`

#### Returns

`AgentAuthenticationError`

#### Overrides

[`BabylonError`](../../base.errors/classes/BabylonError.md).[`constructor`](../../base.errors/classes/BabylonError.md#constructor)

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

[`BabylonError`](../../base.errors/classes/BabylonError.md).[`toJSON`](../../base.errors/classes/BabylonError.md#tojson)

## Properties

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [src/lib/errors/base.errors.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L11)

#### Inherited from

[`BabylonError`](../../base.errors/classes/BabylonError.md).[`timestamp`](../../base.errors/classes/BabylonError.md#timestamp)

***

### context?

> `readonly` `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/errors/base.errors.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L12)

#### Inherited from

[`BabylonError`](../../base.errors/classes/BabylonError.md).[`context`](../../base.errors/classes/BabylonError.md#context)

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

### agentId

> `readonly` **agentId**: `string`

Defined in: [src/lib/errors/domain.errors.ts:87](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L87)

***

### reason

> `readonly` **reason**: `"NOT_REGISTERED"` \| `"INVALID_SIGNATURE"` \| `"EXPIRED_NONCE"` \| `"BANNED"`

Defined in: [src/lib/errors/domain.errors.ts:88](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L88)
