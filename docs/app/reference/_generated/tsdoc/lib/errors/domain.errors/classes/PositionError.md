[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/domain.errors](../README.md) / PositionError

# Class: PositionError

Defined in: [src/lib/errors/domain.errors.ts:46](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L46)

Position error for position management issues

## Extends

- [`BusinessLogicError`](../../base.errors/classes/BusinessLogicError.md)

## Constructors

### Constructor

> **new PositionError**(`message`, `positionId`, `poolId`, `reason`): `PositionError`

Defined in: [src/lib/errors/domain.errors.ts:47](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L47)

#### Parameters

##### message

`string`

##### positionId

`string`

##### poolId

`string`

##### reason

`"NOT_FOUND"` | `"ALREADY_CLOSED"` | `"INSUFFICIENT_MARGIN"` | `"MAX_LEVERAGE"`

#### Returns

`PositionError`

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

### positionId

> `readonly` **positionId**: `string`

Defined in: [src/lib/errors/domain.errors.ts:49](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L49)

***

### poolId

> `readonly` **poolId**: `string`

Defined in: [src/lib/errors/domain.errors.ts:50](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L50)

***

### reason

> `readonly` **reason**: `"NOT_FOUND"` \| `"ALREADY_CLOSED"` \| `"INSUFFICIENT_MARGIN"` \| `"MAX_LEVERAGE"`

Defined in: [src/lib/errors/domain.errors.ts:51](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/domain.errors.ts#L51)
