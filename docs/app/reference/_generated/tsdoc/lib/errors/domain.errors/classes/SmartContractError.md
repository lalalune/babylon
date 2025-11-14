[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/domain.errors](../README.md) / SmartContractError

# Class: SmartContractError

Defined in: [src/lib/errors/domain.errors.ts:145](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L145)

Smart contract error for contract interactions

## Extends

- [`BabylonError`](../../base.errors/classes/BabylonError.md)

## Constructors

### Constructor

> **new SmartContractError**(`message`, `contractAddress`, `method`, `revertReason?`, `txHash?`, `blockNumber?`, `gasUsed?`): `SmartContractError`

Defined in: [src/lib/errors/domain.errors.ts:146](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L146)

#### Parameters

##### message

`string`

##### contractAddress

`string`

##### method

`string`

##### revertReason?

`string`

##### txHash?

`string`

##### blockNumber?

`number`

##### gasUsed?

`string`

#### Returns

`SmartContractError`

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

### contractAddress

> `readonly` **contractAddress**: `string`

Defined in: [src/lib/errors/domain.errors.ts:148](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L148)

***

### method

> `readonly` **method**: `string`

Defined in: [src/lib/errors/domain.errors.ts:149](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L149)

***

### revertReason?

> `readonly` `optional` **revertReason**: `string`

Defined in: [src/lib/errors/domain.errors.ts:150](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L150)

***

### txHash?

> `readonly` `optional` **txHash**: `string`

Defined in: [src/lib/errors/domain.errors.ts:151](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L151)

***

### blockNumber?

> `readonly` `optional` **blockNumber**: `number`

Defined in: [src/lib/errors/domain.errors.ts:152](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L152)

***

### gasUsed?

> `readonly` `optional` **gasUsed**: `string`

Defined in: [src/lib/errors/domain.errors.ts:153](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L153)
