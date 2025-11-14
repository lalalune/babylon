[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/identity/AgentWalletService](../README.md) / AgentWalletService

# Class: AgentWalletService

Defined in: [src/lib/agents/identity/AgentWalletService.ts:25](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentWalletService.ts#L25)

## Constructors

### Constructor

> **new AgentWalletService**(): `AgentWalletService`

#### Returns

`AgentWalletService`

## Methods

### createAgentEmbeddedWallet()

> **createAgentEmbeddedWallet**(`agentUserId`): `Promise`\<\{ `walletAddress`: `string`; `privyUserId`: `string`; `privyWalletId`: `string`; \}\>

Defined in: [src/lib/agents/identity/AgentWalletService.ts:29](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentWalletService.ts#L29)

Create embedded wallet for agent via Privy (server-side, no user interaction)

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<\{ `walletAddress`: `string`; `privyUserId`: `string`; `privyWalletId`: `string`; \}\>

***

### registerAgentOnChain()

> **registerAgentOnChain**(`agentUserId`): `Promise`\<\{ `tokenId`: `number`; `txHash`: `string`; `metadataCID?`: `string`; \}\>

Defined in: [src/lib/agents/identity/AgentWalletService.ts:117](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentWalletService.ts#L117)

Register agent on ERC-8004 identity registry (server-side signing, gas handled)

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<\{ `tokenId`: `number`; `txHash`: `string`; `metadataCID?`: `string`; \}\>

***

### setupAgentIdentity()

> **setupAgentIdentity**(`agentUserId`): `Promise`\<\{ `walletAddress`: `string`; `tokenId?`: `number`; `onChainRegistered`: `boolean`; \}\>

Defined in: [src/lib/agents/identity/AgentWalletService.ts:219](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentWalletService.ts#L219)

Complete setup: Create wallet + register on-chain (fully automated)

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<\{ `walletAddress`: `string`; `tokenId?`: `number`; `onChainRegistered`: `boolean`; \}\>

***

### signTransaction()

> **signTransaction**(`agentUserId`, `transactionData`): `Promise`\<`string`\>

Defined in: [src/lib/agents/identity/AgentWalletService.ts:259](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentWalletService.ts#L259)

Sign transaction for agent (server-side, no user interaction)

#### Parameters

##### agentUserId

`string`

##### transactionData

###### to

`string`

###### value

`string`

###### data

`string`

#### Returns

`Promise`\<`string`\>

***

### verifyOnChainIdentity()

> **verifyOnChainIdentity**(`agentUserId`): `Promise`\<`boolean`\>

Defined in: [src/lib/agents/identity/AgentWalletService.ts:297](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentWalletService.ts#L297)

Verify agent has valid on-chain identity

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<`boolean`\>
