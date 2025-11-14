[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/tag-storage-service](../README.md) / storeTagsForPost

# Function: storeTagsForPost()

> **storeTagsForPost**(`postId`, `tags`): `Promise`\<`void`\>

Defined in: [src/lib/services/tag-storage-service.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/tag-storage-service.ts#L17)

Store tags for a post
- Creates tags if they don't exist
- Links tags to post via PostTag join table

## Parameters

### postId

`string`

### tags

[`GeneratedTag`](../../tag-generation-service/interfaces/GeneratedTag.md)[]

## Returns

`Promise`\<`void`\>
