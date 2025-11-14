[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/swagger/types](../README.md) / OpenAPIRoute

# Interface: OpenAPIRoute

Defined in: [src/lib/swagger/types.ts:14](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L14)

OpenAPI route documentation

## Description

Used to document API routes in a type-safe way

## Properties

### path

> **path**: `string`

Defined in: [src/lib/swagger/types.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L16)

Route path (e.g., '/api/users/me')

***

### methods

> **methods**: (`"POST"` \| `"GET"` \| `"PUT"` \| `"PATCH"` \| `"DELETE"`)[]

Defined in: [src/lib/swagger/types.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L18)

HTTP method(s) supported

***

### summary

> **summary**: `string`

Defined in: [src/lib/swagger/types.ts:20](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L20)

Route summary (short description)

***

### description

> **description**: `string`

Defined in: [src/lib/swagger/types.ts:22](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L22)

Detailed description

***

### tags

> **tags**: `string`[]

Defined in: [src/lib/swagger/types.ts:24](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L24)

Tags for grouping in Swagger UI

***

### requiresAuth

> **requiresAuth**: `boolean`

Defined in: [src/lib/swagger/types.ts:26](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L26)

Whether authentication is required

***

### parameters?

> `optional` **parameters**: [`OpenAPIParameter`](OpenAPIParameter.md)[]

Defined in: [src/lib/swagger/types.ts:28](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L28)

Query parameters

***

### requestBody?

> `optional` **requestBody**: `object`

Defined in: [src/lib/swagger/types.ts:30](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L30)

Request body schema

#### required

> **required**: `boolean`

#### content

> **content**: `Record`\<`string`, \{ `schema`: `object`; \}\>

***

### responses

> **responses**: `Record`\<`number`, [`OpenAPIResponse`](OpenAPIResponse.md)\>

Defined in: [src/lib/swagger/types.ts:35](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/types.ts#L35)

Response schemas
