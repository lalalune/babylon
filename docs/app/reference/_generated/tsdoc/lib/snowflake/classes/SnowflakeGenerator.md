[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/snowflake](../README.md) / SnowflakeGenerator

# Class: SnowflakeGenerator

Defined in: [src/lib/snowflake.ts:34](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/snowflake.ts#L34)

Export the class for advanced usage

## Constructors

### Constructor

> **new SnowflakeGenerator**(`workerId`): `SnowflakeGenerator`

Defined in: [src/lib/snowflake.ts:39](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/snowflake.ts#L39)

#### Parameters

##### workerId

`number` = `0`

#### Returns

`SnowflakeGenerator`

## Methods

### generate()

> **generate**(): `string`

Defined in: [src/lib/snowflake.ts:49](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/snowflake.ts#L49)

Generate a new Snowflake ID

#### Returns

`string`

***

### parse()

> `static` **parse**(`id`): `object`

Defined in: [src/lib/snowflake.ts:94](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/snowflake.ts#L94)

Parse a Snowflake ID to extract its components

#### Parameters

##### id

`string` | `bigint`

#### Returns

`object`

##### timestamp

> **timestamp**: `Date`

##### workerId

> **workerId**: `number`

##### sequence

> **sequence**: `number`

***

### isValid()

> `static` **isValid**(`id`): `boolean`

Defined in: [src/lib/snowflake.ts:115](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/snowflake.ts#L115)

Check if a string is a valid Snowflake ID

#### Parameters

##### id

`string`

#### Returns

`boolean`
