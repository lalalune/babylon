[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/chat](../README.md) / ChatMessageQuerySchema

# Variable: ChatMessageQuerySchema

> `const` **ChatMessageQuerySchema**: `ZodObject`\<\{ `chatId`: `ZodOptional`\<`ZodString`\>; `page`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `sortBy`: `ZodOptional`\<`ZodString`\>; `sortOrder`: `ZodDefault`\<`ZodEnum`\<\{ `asc`: `"asc"`; `desc`: `"desc"`; \}\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/chat.ts:60](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/chat.ts#L60)

Chat message query schema
