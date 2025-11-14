[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/base.errors](../README.md) / BusinessLogicError

# Class: BusinessLogicError

Defined in: [src/lib/errors/base.errors.ts:180](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L180)

Business logic error for domain-specific errors

## Extends

- [`BabylonError`](BabylonError.md)

## Extended by

- [`InsufficientFundsError`](../../domain.errors/classes/InsufficientFundsError.md)
- [`PositionError`](../../domain.errors/classes/PositionError.md)
- [`CoalitionError`](../../domain.errors/classes/CoalitionError.md)
- [`WalletError`](../../domain.errors/classes/WalletError.md)
- [`DepositError`](../../domain.errors/classes/DepositError.md)
- [`WithdrawalError`](../../domain.errors/classes/WithdrawalError.md)
- [`GameError`](../../domain.errors/classes/GameError.md)
- [`FeedError`](../../domain.errors/classes/FeedError.md)
- [`PaymentError`](../../domain.errors/classes/PaymentError.md)

## Constructors

### Constructor

> **new BusinessLogicError**(`message`, `code`, `context?`): `BusinessLogicError`

Defined in: [src/lib/errors/base.errors.ts:181](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L181)

#### Parameters

##### message

`string`

##### code

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`BusinessLogicError`

#### Overrides

[`BabylonError`](BabylonError.md).[`constructor`](BabylonError.md#constructor)

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

[`BabylonError`](BabylonError.md).[`toJSON`](BabylonError.md#tojson)

## Properties

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [src/lib/errors/base.errors.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L11)

#### Inherited from

[`BabylonError`](BabylonError.md).[`timestamp`](BabylonError.md#timestamp)

***

### context?

> `readonly` `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [src/lib/errors/base.errors.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L12)

#### Inherited from

[`BabylonError`](BabylonError.md).[`context`](BabylonError.md#context)

***

### code

> `readonly` **code**: `string`

Defined in: [src/lib/errors/base.errors.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L16)

#### Inherited from

[`BabylonError`](BabylonError.md).[`code`](BabylonError.md#code)

***

### statusCode

> `readonly` **statusCode**: `number` = `500`

Defined in: [src/lib/errors/base.errors.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L17)

#### Inherited from

[`BabylonError`](BabylonError.md).[`statusCode`](BabylonError.md#statuscode)

***

### isOperational

> `readonly` **isOperational**: `boolean` = `true`

Defined in: [src/lib/errors/base.errors.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/base.errors.ts#L18)

#### Inherited from

[`BabylonError`](BabylonError.md).[`isOperational`](BabylonError.md#isoperational)
