[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/a2a/client/http-a2a-client](../README.md) / HttpA2AClient

# Class: HttpA2AClient

Defined in: [src/lib/a2a/client/http-a2a-client.ts:23](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L23)

## Constructors

### Constructor

> **new HttpA2AClient**(`config`): `HttpA2AClient`

Defined in: [src/lib/a2a/client/http-a2a-client.ts:27](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L27)

#### Parameters

##### config

[`HttpA2AClientConfig`](../interfaces/HttpA2AClientConfig.md)

#### Returns

`HttpA2AClient`

## Methods

### request()

> **request**(`method`, `params?`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:37](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L37)

Send a JSON-RPC request

#### Parameters

##### method

`string`

##### params?

`unknown`

#### Returns

`Promise`\<`unknown`\>

***

### getMarketData()

> **getMarketData**(`marketId`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:80](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L80)

Market Data Methods

#### Parameters

##### marketId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getMarketPrices()

> **getMarketPrices**(`marketId`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:84](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L84)

#### Parameters

##### marketId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### subscribeMarket()

> **subscribeMarket**(`marketId`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:88](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L88)

#### Parameters

##### marketId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getBalance()

> **getBalance**(`userId?`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:95](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L95)

Portfolio Methods

#### Parameters

##### userId?

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getPositions()

> **getPositions**(`userId?`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:99](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L99)

#### Parameters

##### userId?

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getUserWallet()

> **getUserWallet**(`userId`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:103](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L103)

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### discoverAgents()

> **discoverAgents**(`filters?`, `limit?`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:110](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L110)

Agent Discovery Methods

#### Parameters

##### filters?

###### strategies?

`string`[]

###### markets?

`string`[]

###### minReputation?

`number`

##### limit?

`number`

#### Returns

`Promise`\<`unknown`\>

***

### getAgentInfo()

> **getAgentInfo**(`agentId`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:118](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L118)

#### Parameters

##### agentId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### proposeCoalition()

> **proposeCoalition**(`params`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:125](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L125)

Coalition Methods

#### Parameters

##### params

###### name

`string`

###### strategy

`string`

###### targetMarket?

`string`

#### Returns

`Promise`\<`unknown`\>

***

### joinCoalition()

> **joinCoalition**(`coalitionId`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:133](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L133)

#### Parameters

##### coalitionId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### leaveCoalition()

> **leaveCoalition**(`coalitionId`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:137](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L137)

#### Parameters

##### coalitionId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### sendCoalitionMessage()

> **sendCoalitionMessage**(`params`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:141](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L141)

#### Parameters

##### params

###### coalitionId

`string`

###### messageType

`string`

###### content

`unknown`

#### Returns

`Promise`\<`unknown`\>

***

### shareAnalysis()

> **shareAnalysis**(`analysis`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:152](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L152)

Analysis Sharing Methods

#### Parameters

##### analysis

###### marketId

`string`

###### prediction

`number`

###### confidence

`number`

###### reasoning?

`string`

###### dataPoints?

`unknown`[]

###### timestamp

`number`

#### Returns

`Promise`\<`unknown`\>

***

### requestAnalysis()

> **requestAnalysis**(`params`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:163](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L163)

#### Parameters

##### params

###### marketId

`string`

###### paymentOffer?

`string`

###### deadline

`number`

#### Returns

`Promise`\<`unknown`\>

***

### getAnalyses()

> **getAnalyses**(`marketId`, `limit?`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:171](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L171)

#### Parameters

##### marketId

`string`

##### limit?

`number`

#### Returns

`Promise`\<`unknown`\>

***

### sendRequest()

> **sendRequest**(`method`, `params?`): `Promise`\<`unknown`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:179](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L179)

Send a generic JSON-RPC request (alias for request)
Kept for backward compatibility with old code

#### Parameters

##### method

`string`

##### params?

`unknown`

#### Returns

`Promise`\<`unknown`\>

***

### isConnected()

> **isConnected**(): `boolean`

Defined in: [src/lib/a2a/client/http-a2a-client.ts:187](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L187)

Check if client is connected (always true for HTTP)
Kept for backward compatibility

#### Returns

`boolean`

***

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [src/lib/a2a/client/http-a2a-client.ts:194](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/client/http-a2a-client.ts#L194)

Close the client (no-op for HTTP, kept for API compatibility)

#### Returns

`Promise`\<`void`\>
