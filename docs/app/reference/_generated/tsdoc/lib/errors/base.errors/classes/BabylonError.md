[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/base.errors](../README.md) / BabylonError

# Abstract Class: BabylonError

Defined in: [src/lib/errors/base.errors.ts:10](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L10)

Base error class for all Babylon errors
Extends the native Error class with additional context and metadata

## Extends

- `Error`

## Extended by

- [`ValidationError`](ValidationError.md)
- [`AuthenticationError`](AuthenticationError.md)
- [`AuthorizationError`](AuthorizationError.md)
- [`NotFoundError`](NotFoundError.md)
- [`ConflictError`](ConflictError.md)
- [`DatabaseError`](DatabaseError.md)
- [`ExternalServiceError`](ExternalServiceError.md)
- [`RateLimitError`](RateLimitError.md)
- [`BusinessLogicError`](BusinessLogicError.md)
- [`BadRequestError`](BadRequestError.md)
- [`InternalServerError`](InternalServerError.md)
- [`ServiceUnavailableError`](ServiceUnavailableError.md)
- [`TradingError`](../../domain.errors/classes/TradingError.md)
- [`AgentError`](../../domain.errors/classes/AgentError.md)
- [`AgentAuthenticationError`](../../domain.errors/classes/AgentAuthenticationError.md)
- [`BlockchainError`](../../domain.errors/classes/BlockchainError.md)
- [`SmartContractError`](../../domain.errors/classes/SmartContractError.md)
- [`LLMError`](../../domain.errors/classes/LLMError.md)

## Constructors

### Constructor

> **new BabylonError**(`message`, `code`, `statusCode`, `isOperational`, `context?`): `BabylonError`

Defined in: [src/lib/errors/base.errors.ts:14](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L14)

#### Parameters

##### message

`string`

##### code

`string`

##### statusCode

`number` = `500`

##### isOperational

`boolean` = `true`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`BabylonError`

#### Overrides

`Error.constructor`

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

## Properties

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [src/lib/errors/base.errors.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L11)

***

### context?

> `readonly` `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/errors/base.errors.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L12)

***

### code

> `readonly` **code**: `string`

Defined in: [src/lib/errors/base.errors.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L16)

***

### statusCode

> `readonly` **statusCode**: `number` = `500`

Defined in: [src/lib/errors/base.errors.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L17)

***

### isOperational

> `readonly` **isOperational**: `boolean` = `true`

Defined in: [src/lib/errors/base.errors.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L18)
