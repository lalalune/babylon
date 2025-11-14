[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/domain.errors](../README.md) / BlockchainError

# Class: BlockchainError

Defined in: [src/lib/errors/domain.errors.ts:120](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L120)

Blockchain error for web3 interactions

## Extends

- [`BabylonError`](../../base.errors/classes/BabylonError.md)

## Constructors

### Constructor

> **new BlockchainError**(`message`, `txHash?`, `blockNumber?`, `gasUsed?`): `BlockchainError`

Defined in: [src/lib/errors/domain.errors.ts:121](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L121)

#### Parameters

##### message

`string`

##### txHash?

`string`

##### blockNumber?

`number`

##### gasUsed?

`string`

#### Returns

`BlockchainError`

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

### txHash?

> `readonly` `optional` **txHash**: `string`

Defined in: [src/lib/errors/domain.errors.ts:123](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L123)

***

### blockNumber?

> `readonly` `optional` **blockNumber**: `number`

Defined in: [src/lib/errors/domain.errors.ts:124](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L124)

***

### gasUsed?

> `readonly` `optional` **gasUsed**: `string`

Defined in: [src/lib/errors/domain.errors.ts:125](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L125)
