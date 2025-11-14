[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/assets](../README.md) / getProfileImageUrl

# Function: getProfileImageUrl()

> **getProfileImageUrl**(`profileImageUrl`, `userId`, `isActor`): `string` \| `null`

Defined in: [src/lib/assets.ts:57](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/assets.ts#L57)

Get actor/user profile image URL
Tries multiple sources in order:
1. Uploaded profile image URL (from CDN storage - Vercel Blob or MinIO)
2. Static actor image from CDN or public/images/actors/
3. Returns null if not found (Avatar component will handle fallback on error)

## Parameters

### profileImageUrl

`string` | `null` | `undefined`

### userId

`string` | `null` | `undefined`

### isActor

`boolean` = `true`

## Returns

`string` \| `null`
