[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/swagger/types](../README.md) / OpenAPIParameter

# Interface: OpenAPIParameter

Defined in: [src/lib/swagger/types.ts:41](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L41)

OpenAPI parameter definition

## Properties

### name

> **name**: `string`

Defined in: [src/lib/swagger/types.ts:43](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L43)

Parameter name

***

### in

> **in**: `"path"` \| `"query"` \| `"header"` \| `"cookie"`

Defined in: [src/lib/swagger/types.ts:45](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L45)

Where the parameter is located

***

### description

> **description**: `string`

Defined in: [src/lib/swagger/types.ts:47](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L47)

Parameter description

***

### required

> **required**: `boolean`

Defined in: [src/lib/swagger/types.ts:49](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L49)

Whether parameter is required

***

### schema

> **schema**: `object`

Defined in: [src/lib/swagger/types.ts:51](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L51)

Parameter schema

#### type

> **type**: `string`

#### format?

> `optional` **format**: `string`

#### enum?

> `optional` **enum**: `string`[]

#### default?

> `optional` **default**: `unknown`
