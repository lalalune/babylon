[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/api/fetch](../README.md) / apiFetch

# Function: apiFetch()

> **apiFetch**(`input`, `init`): `Promise`\<`Response`\>

Defined in: [src/lib/api/fetch.ts:39](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/api/fetch.ts#L39)

Lightweight wrapper around fetch that decorates requests with the latest
Privy access token stored on window. Centralising this logic avoids
sprinkling direct window lookups across the codebase and keeps future
Privy integration changes localised.

Automatically retries requests with a fresh token if a 401 error is received.

## Parameters

### input

`RequestInfo`

### init

[`ApiFetchOptions`](../interfaces/ApiFetchOptions.md) = `{}`

## Returns

`Promise`\<`Response`\>
