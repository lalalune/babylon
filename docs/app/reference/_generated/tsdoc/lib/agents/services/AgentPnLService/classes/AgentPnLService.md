[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/services/AgentPnLService](../README.md) / AgentPnLService

# Class: AgentPnLService

Defined in: [src/lib/agents/services/AgentPnLService.ts:11](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/services/AgentPnLService.ts#L11)

## Constructors

### Constructor

> **new AgentPnLService**(): `AgentPnLService`

#### Returns

`AgentPnLService`

## Methods

### recordTrade()

> **recordTrade**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/agents/services/AgentPnLService.ts:15](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/services/AgentPnLService.ts#L15)

Record a trade for an agent

#### Parameters

##### params

###### agentId

`string`

###### userId

`string`

###### marketType

`"prediction"` \| `"perp"`

###### marketId?

`string`

###### ticker?

`string`

###### action

`"open"` \| `"close"`

###### side?

`"long"` \| `"short"` \| `"yes"` \| `"no"`

###### amount

`number`

###### price

`number`

###### pnl?

`number`

###### reasoning?

`string`

#### Returns

`Promise`\<`void`\>

***

### getAgentTrades()

> **getAgentTrades**(`agentUserId`, `limit`): `Promise`\<`object`[]\>

Defined in: [src/lib/agents/services/AgentPnLService.ts:95](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/services/AgentPnLService.ts#L95)

Get agent trades

#### Parameters

##### agentUserId

`string`

##### limit

`number` = `50`

#### Returns

`Promise`\<`object`[]\>

***

### getUserAgentPnL()

> **getUserAgentPnL**(`userId`): `Promise`\<`number`\>

Defined in: [src/lib/agents/services/AgentPnLService.ts:103](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/services/AgentPnLService.ts#L103)

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`number`\>

***

### syncUserAgentPnL()

> **syncUserAgentPnL**(`userId`): `Promise`\<`void`\>

Defined in: [src/lib/agents/services/AgentPnLService.ts:112](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/services/AgentPnLService.ts#L112)

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>
