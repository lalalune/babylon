[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/IPFSPublisher](../README.md) / AgentMetadataSchema

# Variable: AgentMetadataSchema

> `const` **AgentMetadataSchema**: `ZodObject`\<\{ `name`: `ZodString`; `description`: `ZodString`; `image`: `ZodOptional`\<`ZodString`\>; `version`: `ZodString`; `type`: `ZodOptional`\<`ZodString`\>; `endpoints`: `ZodObject`\<\{ `mcp`: `ZodOptional`\<`ZodString`\>; `a2a`: `ZodOptional`\<`ZodString`\>; `api`: `ZodOptional`\<`ZodString`\>; `docs`: `ZodOptional`\<`ZodString`\>; `websocket`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>; `capabilities`: `ZodObject`\<\{ `strategies`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `markets`: `ZodArray`\<`ZodString`\>; `actions`: `ZodArray`\<`ZodString`\>; `tools`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `skills`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `protocols`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; `socialFeatures`: `ZodOptional`\<`ZodBoolean`\>; `realtime`: `ZodOptional`\<`ZodBoolean`\>; `authentication`: `ZodOptional`\<`ZodArray`\<`ZodString`\>\>; \}, `$strip`\>; `metadata`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; `mcp`: `ZodOptional`\<`ZodObject`\<\{ `tools`: `ZodArray`\<`ZodObject`\<\{ `name`: `ZodString`; `description`: `ZodString`; `inputSchema`: `ZodRecord`\<`ZodString`, `ZodUnknown`\>; \}, `$strip`\>\>; \}, `$strip`\>\>; `babylon`: `ZodOptional`\<`ZodObject`\<\{ `agentId`: `ZodOptional`\<`ZodString`\>; `tokenId`: `ZodOptional`\<`ZodNumber`\>; `walletAddress`: `ZodOptional`\<`ZodString`\>; `registrationTxHash`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>\>; \}, `$strip`\>

Defined in: [src/agents/agent0/IPFSPublisher.ts:13](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/IPFSPublisher.ts#L13)
