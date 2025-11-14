[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/api/auth-middleware](../README.md) / optionalAuthFromHeaders

# Function: optionalAuthFromHeaders()

> **optionalAuthFromHeaders**(`headers`): `Promise`\<[`AuthenticatedUser`](../interfaces/AuthenticatedUser.md) \| `null`\>

Defined in: [src/lib/api/auth-middleware.ts:142](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/api/auth-middleware.ts#L142)

Optional authentication from headers - for use when NextRequest is not available
Returns user if authenticated, null otherwise

## Parameters

### headers

`Headers`

## Returns

`Promise`\<[`AuthenticatedUser`](../interfaces/AuthenticatedUser.md) \| `null`\>
