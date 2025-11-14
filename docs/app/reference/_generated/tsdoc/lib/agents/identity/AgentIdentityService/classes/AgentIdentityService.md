[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/identity/AgentIdentityService](../README.md) / AgentIdentityService

# Class: AgentIdentityService

Defined in: [src/lib/agents/identity/AgentIdentityService.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentIdentityService.ts#L18)

## Constructors

### Constructor

> **new AgentIdentityService**(): `AgentIdentityService`

#### Returns

`AgentIdentityService`

## Methods

### createAgentWallet()

> **createAgentWallet**(`agentUserId`): `Promise`\<\{ `walletAddress`: `string`; `privyWalletId`: `string`; \}\>

Defined in: [src/lib/agents/identity/AgentIdentityService.ts:22](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentIdentityService.ts#L22)

Create embedded wallet for agent user via Privy

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<\{ `walletAddress`: `string`; `privyWalletId`: `string`; \}\>

***

### registerOnAgent0()

> **registerOnAgent0**(`agentUserId`): `Promise`\<\{ `agent0TokenId`: `number`; `metadataCID?`: `string`; `txHash?`: `string`; \}\>

Defined in: [src/lib/agents/identity/AgentIdentityService.ts:65](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentIdentityService.ts#L65)

Register agent user on Agent0 network

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<\{ `agent0TokenId`: `number`; `metadataCID?`: `string`; `txHash?`: `string`; \}\>

***

### setupAgentIdentity()

> **setupAgentIdentity**(`agentUserId`): `Promise`\<\{ \}\>

Defined in: [src/lib/agents/identity/AgentIdentityService.ts:143](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentIdentityService.ts#L143)

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<\{ \}\>

***

### verifyAgentIdentity()

> **verifyAgentIdentity**(`agentUserId`): `Promise`\<`boolean`\>

Defined in: [src/lib/agents/identity/AgentIdentityService.ts:158](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/identity/AgentIdentityService.ts#L158)

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<`boolean`\>
