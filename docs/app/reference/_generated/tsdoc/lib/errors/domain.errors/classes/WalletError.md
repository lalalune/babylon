[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/domain.errors](../README.md) / WalletError

# Class: WalletError

Defined in: [src/lib/errors/domain.errors.ts:176](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L176)

Wallet error for wallet operations

## Extends

- [`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md)

## Constructors

### Constructor

> **new WalletError**(`message`, `walletAddress`, `reason`): `WalletError`

Defined in: [src/lib/errors/domain.errors.ts:177](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L177)

#### Parameters

##### message

`string`

##### walletAddress

`string`

##### reason

`"INVALID_ADDRESS"` | `"NOT_CONNECTED"` | `"WRONG_NETWORK"` | `"INSUFFICIENT_GAS"` | `"USER_REJECTED"`

#### Returns

`WalletError`

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

### walletAddress

> `readonly` **walletAddress**: `string`

Defined in: [src/lib/errors/domain.errors.ts:179](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L179)

***

### reason

> `readonly` **reason**: `"INVALID_ADDRESS"` \| `"NOT_CONNECTED"` \| `"WRONG_NETWORK"` \| `"INSUFFICIENT_GAS"` \| `"USER_REJECTED"`

Defined in: [src/lib/errors/domain.errors.ts:180](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L180)
