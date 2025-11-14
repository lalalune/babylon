[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/errors/api-errors](../README.md) / requirePermission

# Function: requirePermission()

> **requirePermission**(`hasPermission`, `resource`): `asserts hasPermission`

Defined in: [src/lib/errors/api-errors.ts:294](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/errors/api-errors.ts#L294)

Assert user has required permission

## Parameters

### hasPermission

`boolean`

Permission check result

### resource

`string` = `'this resource'`

Resource being accessed

## Returns

`asserts hasPermission`

## Throws

ForbiddenError if permission denied
