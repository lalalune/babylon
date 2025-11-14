[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/api/admin-middleware](../README.md) / requireAdmin

# Function: requireAdmin()

> **requireAdmin**(`request`): `Promise`\<[`AuthenticatedUser`](../../auth-middleware/interfaces/AuthenticatedUser.md)\>

Defined in: [src/lib/api/admin-middleware.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/api/admin-middleware.ts#L18)

Authenticate request and verify admin privileges

## Parameters

### request

`NextRequest`

## Returns

`Promise`\<[`AuthenticatedUser`](../../auth-middleware/interfaces/AuthenticatedUser.md)\>

## Throws

if user is not authenticated or not an admin
