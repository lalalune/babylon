[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/posthog/server](../README.md) / trackServerError

# Function: trackServerError()

> **trackServerError**(`distinctId`, `error`, `context`): `Promise`\<`void`\>

Defined in: [src/lib/posthog/server.ts:79](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/posthog/server.ts#L79)

Track API error

## Parameters

### distinctId

`string` | `null`

### error

`Error`

### context

#### endpoint

`string`

#### method

`string`

#### statusCode?

`number`

## Returns

`Promise`\<`void`\>
