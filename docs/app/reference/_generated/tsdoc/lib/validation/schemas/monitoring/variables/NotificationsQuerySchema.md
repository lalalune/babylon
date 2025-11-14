[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/monitoring](../README.md) / NotificationsQuerySchema

# Variable: NotificationsQuerySchema

> `const` **NotificationsQuerySchema**: `ZodObject`\<\{ `page`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `sortBy`: `ZodOptional`\<`ZodString`\>; `sortOrder`: `ZodDefault`\<`ZodEnum`\<\{ `asc`: `"asc"`; `desc`: `"desc"`; \}\>\>; `unreadOnly`: `ZodDefault`\<`ZodCoercedBoolean`\<`unknown`\>\>; `type`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/monitoring.ts:36](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/monitoring.ts#L36)

Notifications query schema
