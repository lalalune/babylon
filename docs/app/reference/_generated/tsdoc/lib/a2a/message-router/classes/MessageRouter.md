[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/a2a/message-router](../README.md) / MessageRouter

# Class: MessageRouter

Defined in: [src/lib/a2a/message-router.ts:52](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/message-router.ts#L52)

## Constructors

### Constructor

> **new MessageRouter**(`config`, `registryClient?`, `x402Manager?`, `agent0Client?`, `unifiedDiscovery?`): `MessageRouter`

Defined in: [src/lib/a2a/message-router.ts:66](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/message-router.ts#L66)

#### Parameters

##### config

`A2AServerConfig` | `Partial`\<`A2AServerConfig`\>

##### registryClient?

`RegistryClient`

##### x402Manager?

`X402Manager`

##### agent0Client?

[`IAgent0Client`](../../../../agents/agent0/types/interfaces/IAgent0Client.md)

##### unifiedDiscovery?

[`IUnifiedDiscoveryService`](../../../../agents/agent0/types/interfaces/IUnifiedDiscoveryService.md)

#### Returns

`MessageRouter`

## Methods

### route()

> **route**(`agentId`, `request`, `connection`): `Promise`\<`JsonRpcResponse`\>

Defined in: [src/lib/a2a/message-router.ts:95](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/message-router.ts#L95)

Route incoming JSON-RPC message to appropriate handler

#### Parameters

##### agentId

`string`

##### request

`JsonRpcRequest`

##### connection

`AgentConnection`

#### Returns

`Promise`\<`JsonRpcResponse`\>
