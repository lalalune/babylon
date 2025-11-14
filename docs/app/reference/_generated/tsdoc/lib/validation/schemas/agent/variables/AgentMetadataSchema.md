[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/agent](../README.md) / AgentMetadataSchema

# Variable: AgentMetadataSchema

> `const` **AgentMetadataSchema**: `ZodObject`\<\{ `id`: `ZodString`; `name`: `ZodString`; `endpoint`: `ZodNullable`\<`ZodString`\>; `onChainRegistered`: `ZodBoolean`; `nftTokenId`: `ZodNullable`\<`ZodNumber`\>; `agent0TrustScore`: `ZodNumber`; `reputationPoints`: `ZodNumber`; `createdAt`: `ZodString`; `updatedAt`: `ZodString`; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/agent.ts:41](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/agent.ts#L41)

Agent metadata schema (for responses)
