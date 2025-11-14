[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/chat](../README.md) / ChatSchema

# Variable: ChatSchema

> `const` **ChatSchema**: `ZodObject`\<\{ `id`: `ZodString`; `name`: `ZodOptional`\<`ZodString`\>; `isGroup`: `ZodBoolean`; `createdAt`: `ZodDate`; `updatedAt`: `ZodDate`; `participants`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `id`: `ZodString`; `displayName`: `ZodString`; `username`: `ZodOptional`\<`ZodString`\>; `profileImageUrl`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>\>; `lastMessage`: `ZodOptional`\<`ZodObject`\<\{ `id`: `ZodString`; `content`: `ZodString`; `senderId`: `ZodString`; `chatId`: `ZodString`; `createdAt`: `ZodDate`; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/chat.ts:88](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/chat.ts#L88)

Chat response schema
