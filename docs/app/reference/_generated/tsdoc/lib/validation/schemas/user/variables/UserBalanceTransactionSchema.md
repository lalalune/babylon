[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/user](../README.md) / UserBalanceTransactionSchema

# Variable: UserBalanceTransactionSchema

> `const` **UserBalanceTransactionSchema**: `ZodObject`\<\{ `amount`: `ZodNumber`; `type`: `ZodEnum`\<\{ `deposit`: `"deposit"`; `withdrawal`: `"withdrawal"`; `trade_profit`: `"trade_profit"`; `trade_loss`: `"trade_loss"`; `fee`: `"fee"`; `reward`: `"reward"`; \}\>; `description`: `ZodOptional`\<`ZodString`\>; `transactionHash`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/user.ts:80](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/user.ts#L80)

User balance transaction schema
