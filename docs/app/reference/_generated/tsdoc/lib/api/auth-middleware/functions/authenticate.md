[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/api/auth-middleware](../README.md) / authenticate

# Function: authenticate()

> **authenticate**(`request`): `Promise`\<[`AuthenticatedUser`](../interfaces/AuthenticatedUser.md)\>

Defined in: [src/lib/api/auth-middleware.ts:77](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/api/auth-middleware.ts#L77)

Authenticate request and return user info
Supports both Privy user tokens and agent session tokens
Checks both Authorization header and privy-token cookie

## Parameters

### request

`NextRequest`

## Returns

`Promise`\<[`AuthenticatedUser`](../interfaces/AuthenticatedUser.md)\>
