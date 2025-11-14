[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/plugins/babylon](../README.md) / initializeBabylonPlugin

# Function: initializeBabylonPlugin()

> **initializeBabylonPlugin**(`runtime`, `config`): `Promise`\<\{ `a2aClient`: [`HttpA2AClient`](../../../../a2a/client/http-a2a-client/classes/HttpA2AClient.md); `plugin`: `Plugin`; \}\>

Defined in: [src/lib/agents/plugins/babylon/index.ts:191](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/plugins/babylon/index.ts#L191)

Initialize the plugin with an A2A client (Manual Setup)

NOTE: This is typically not needed as the plugin auto-initializes via
AgentRuntimeManager. Use this only for custom/standalone setups.

A2A connection is REQUIRED - will throw if connection fails

## Parameters

### runtime

`any`

### config

#### endpoint

`string`

#### credentials

\{ `address`: `string`; `privateKey`: `string`; `tokenId?`: `number`; \}

#### credentials.address

`string`

#### credentials.privateKey

`string`

#### credentials.tokenId?

`number`

#### capabilities?

\{ `strategies?`: `string`[]; `markets?`: `string`[]; `actions?`: `string`[]; `version?`: `string`; \}

#### capabilities.strategies?

`string`[]

#### capabilities.markets?

`string`[]

#### capabilities.actions?

`string`[]

#### capabilities.version?

`string`

## Returns

`Promise`\<\{ `a2aClient`: [`HttpA2AClient`](../../../../a2a/client/http-a2a-client/classes/HttpA2AClient.md); `plugin`: `Plugin`; \}\>
