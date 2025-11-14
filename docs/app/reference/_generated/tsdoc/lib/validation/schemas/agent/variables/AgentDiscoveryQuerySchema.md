[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/agent](../README.md) / AgentDiscoveryQuerySchema

# Variable: AgentDiscoveryQuerySchema

> `const` **AgentDiscoveryQuerySchema**: `ZodObject`\<\{ `strategies`: `ZodOptional`\<`ZodString`\>; `markets`: `ZodOptional`\<`ZodString`\>; `minReputation`: `ZodOptional`\<`ZodCoercedNumber`\<`unknown`\>\>; `external`: `ZodOptional`\<`ZodEnum`\<\{ `true`: `"true"`; `false`: `"false"`; \}\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/agent.ts:23](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/agent.ts#L23)

Agent discovery query parameters schema
