[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/agent](../README.md) / AgentFeedbackCreateSchema

# Variable: AgentFeedbackCreateSchema

> `const` **AgentFeedbackCreateSchema**: `ZodObject`\<\{ `targetAgentId`: `ZodUnion`\<readonly \[`ZodNumber`, `ZodPipe`\<`ZodString`, `ZodTransform`\<`number`, `string`\>\>\]\>; `rating`: `ZodNumber`; `comment`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/agent.ts:56](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/agent.ts#L56)

Agent feedback submission schema
