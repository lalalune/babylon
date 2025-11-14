[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/assets](../README.md) / getStaticAssetUrl

# Function: getStaticAssetUrl()

> **getStaticAssetUrl**(`path`): `string`

Defined in: [src/lib/assets.ts:20](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/assets.ts#L20)

Get the base URL for static assets
In Next.js, files in /public are served from the root path /
This function supports both:
- Legacy public folder assets (during migration)
- CDN assets (Vercel Blob in production, MinIO in dev)

## Parameters

### path

`string`

## Returns

`string`
