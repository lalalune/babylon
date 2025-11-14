[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/IPFSPublisher](../README.md) / IPFSPublisher

# Class: IPFSPublisher

Defined in: [src/agents/agent0/IPFSPublisher.ts:54](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/IPFSPublisher.ts#L54)

## Constructors

### Constructor

> **new IPFSPublisher**(): `IPFSPublisher`

Defined in: [src/agents/agent0/IPFSPublisher.ts:59](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/IPFSPublisher.ts#L59)

No initialization needed - we only fetch via HTTP gateway
Publishing is handled by Agent0 SDK

#### Returns

`IPFSPublisher`

## Methods

### fetchMetadata()

> **fetchMetadata**(`cid`): `Promise`\<\{ `name`: `string`; `description`: `string`; `image?`: `string`; `version`: `string`; `type?`: `string`; `endpoints`: \{ `mcp?`: `string`; `a2a?`: `string`; `api?`: `string`; `docs?`: `string`; `websocket?`: `string`; \}; `capabilities`: \{ `strategies?`: `string`[]; `markets`: `string`[]; `actions`: `string`[]; `tools?`: `string`[]; `skills?`: `string`[]; `protocols?`: `string`[]; `socialFeatures?`: `boolean`; `realtime?`: `boolean`; `authentication?`: `string`[]; \}; `metadata?`: `Record`\<`string`, `unknown`\>; `mcp?`: \{ `tools`: `object`[]; \}; `babylon?`: \{ `agentId?`: `string`; `tokenId?`: `number`; `walletAddress?`: `string`; `registrationTxHash?`: `string`; \}; \}\>

Defined in: [src/agents/agent0/IPFSPublisher.ts:67](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/IPFSPublisher.ts#L67)

Fetch metadata from IPFS by CID via HTTP gateway
Simple and reliable - no IPFS node needed

#### Parameters

##### cid

`string`

#### Returns

`Promise`\<\{ `name`: `string`; `description`: `string`; `image?`: `string`; `version`: `string`; `type?`: `string`; `endpoints`: \{ `mcp?`: `string`; `a2a?`: `string`; `api?`: `string`; `docs?`: `string`; `websocket?`: `string`; \}; `capabilities`: \{ `strategies?`: `string`[]; `markets`: `string`[]; `actions`: `string`[]; `tools?`: `string`[]; `skills?`: `string`[]; `protocols?`: `string`[]; `socialFeatures?`: `boolean`; `realtime?`: `boolean`; `authentication?`: `string`[]; \}; `metadata?`: `Record`\<`string`, `unknown`\>; `mcp?`: \{ `tools`: `object`[]; \}; `babylon?`: \{ `agentId?`: `string`; `tokenId?`: `number`; `walletAddress?`: `string`; `registrationTxHash?`: `string`; \}; \}\>

***

### getGatewayUrl()

> **getGatewayUrl**(`cid`): `string`

Defined in: [src/agents/agent0/IPFSPublisher.ts:91](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/IPFSPublisher.ts#L91)

Get IPFS gateway URL for a CID

#### Parameters

##### cid

`string`

#### Returns

`string`

***

### isAvailable()

> **isAvailable**(): `boolean`

Defined in: [src/agents/agent0/IPFSPublisher.ts:100](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/IPFSPublisher.ts#L100)

Check if IPFS gateway is available
Always returns true since we use public gateway

#### Returns

`boolean`

***

### publishMetadata()

> **publishMetadata**(`_metadata`): `Promise`\<`string`\>

Defined in: [src/agents/agent0/IPFSPublisher.ts:109](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/IPFSPublisher.ts#L109)

Publish metadata to IPFS
DEPRECATED: Use Agent0Client.registerAgent() instead
Agent0 SDK handles IPFS publishing via agent.registerIPFS()

#### Parameters

##### \_metadata

###### name

`string` = `...`

###### description

`string` = `...`

###### image?

`string` = `...`

###### version

`string` = `...`

###### type?

`string` = `...`

###### endpoints

\{ `mcp?`: `string`; `a2a?`: `string`; `api?`: `string`; `docs?`: `string`; `websocket?`: `string`; \} = `...`

###### endpoints.mcp?

`string` = `...`

###### endpoints.a2a?

`string` = `...`

###### endpoints.api?

`string` = `...`

###### endpoints.docs?

`string` = `...`

###### endpoints.websocket?

`string` = `...`

###### capabilities

\{ `strategies?`: `string`[]; `markets`: `string`[]; `actions`: `string`[]; `tools?`: `string`[]; `skills?`: `string`[]; `protocols?`: `string`[]; `socialFeatures?`: `boolean`; `realtime?`: `boolean`; `authentication?`: `string`[]; \} = `...`

###### capabilities.strategies?

`string`[] = `...`

###### capabilities.markets

`string`[] = `...`

###### capabilities.actions

`string`[] = `...`

###### capabilities.tools?

`string`[] = `...`

###### capabilities.skills?

`string`[] = `...`

###### capabilities.protocols?

`string`[] = `...`

###### capabilities.socialFeatures?

`boolean` = `...`

###### capabilities.realtime?

`boolean` = `...`

###### capabilities.authentication?

`string`[] = `...`

###### metadata?

`Record`\<`string`, `unknown`\> = `...`

###### mcp?

\{ `tools`: `object`[]; \} = `...`

###### mcp.tools

`object`[] = `...`

###### babylon?

\{ `agentId?`: `string`; `tokenId?`: `number`; `walletAddress?`: `string`; `registrationTxHash?`: `string`; \} = `...`

###### babylon.agentId?

`string` = `...`

###### babylon.tokenId?

`number` = `...`

###### babylon.walletAddress?

`string` = `...`

###### babylon.registrationTxHash?

`string` = `...`

#### Returns

`Promise`\<`string`\>
