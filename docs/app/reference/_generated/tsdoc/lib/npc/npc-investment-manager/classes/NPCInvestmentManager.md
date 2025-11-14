[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/npc/npc-investment-manager](../README.md) / NPCInvestmentManager

# Class: NPCInvestmentManager

Defined in: [src/lib/npc/npc-investment-manager.ts:53](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-investment-manager.ts#L53)

## Constructors

### Constructor

> **new NPCInvestmentManager**(): `NPCInvestmentManager`

#### Returns

`NPCInvestmentManager`

## Methods

### getPortfolioMetrics()

> `static` **getPortfolioMetrics**(`poolId`): `Promise`\<[`PortfolioMetrics`](../interfaces/PortfolioMetrics.md)\>

Defined in: [src/lib/npc/npc-investment-manager.ts:57](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-investment-manager.ts#L57)

Get portfolio metrics for an NPC pool

#### Parameters

##### poolId

`string`

#### Returns

`Promise`\<[`PortfolioMetrics`](../interfaces/PortfolioMetrics.md)\>

***

### monitorPortfolio()

> `static` **monitorPortfolio**(`poolId`, `npcUserId`, `strategy`): `Promise`\<[`RebalanceAction`](../interfaces/RebalanceAction.md)[]\>

Defined in: [src/lib/npc/npc-investment-manager.ts:144](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-investment-manager.ts#L144)

Monitor portfolio and generate rebalance actions if needed

#### Parameters

##### poolId

`string`

##### npcUserId

`string`

##### strategy

`"aggressive"` | `"conservative"` | `"balanced"`

#### Returns

`Promise`\<[`RebalanceAction`](../interfaces/RebalanceAction.md)[]\>

***

### executeBaselineInvestments()

> `static` **executeBaselineInvestments**(`timestamp`): `Promise`\<`ExecutionResult` \| `null`\>

Defined in: [src/lib/npc/npc-investment-manager.ts:220](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-investment-manager.ts#L220)

Ensure each NPC pool has an initial baseline allocation
Invests ~80% of available balance across aligned companies

#### Parameters

##### timestamp

`Date` = `...`

#### Returns

`Promise`\<`ExecutionResult` \| `null`\>

***

### executeRebalanceAction()

> `static` **executeRebalanceAction**(`npcUserId`, `poolId`, `action`): `Promise`\<`void`\>

Defined in: [src/lib/npc/npc-investment-manager.ts:501](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-investment-manager.ts#L501)

Execute a rebalance action

#### Parameters

##### npcUserId

`string`

##### poolId

`string`

##### action

[`RebalanceAction`](../interfaces/RebalanceAction.md)

#### Returns

`Promise`\<`void`\>

***

### monitorAllNPCPortfolios()

> `static` **monitorAllNPCPortfolios**(): `Promise`\<`void`\>

Defined in: [src/lib/npc/npc-investment-manager.ts:553](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-investment-manager.ts#L553)

Periodic portfolio monitoring for all active NPC pools

#### Returns

`Promise`\<`void`\>

***

### calculateReputationAdjustedAllocation()

> `static` **calculateReputationAdjustedAllocation**(`npcUserId`, `baseAmount`): `Promise`\<`number`\>

Defined in: [src/lib/npc/npc-investment-manager.ts:629](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-investment-manager.ts#L629)

Calculate reputation-adjusted allocation amount for an NPC

Reputation Score (0-100) adjusts allocation:
- Low reputation (0-40): 50% of base allocation (cautious)
- Medium reputation (40-70): 100% of base allocation (standard)
- High reputation (70-100): 150% of base allocation (confident)

#### Parameters

##### npcUserId

`string`

NPC user ID

##### baseAmount

`number`

Base allocation amount

#### Returns

`Promise`\<`number`\>

Adjusted allocation amount

***

### getRecommendedPositionSize()

> `static` **getRecommendedPositionSize**(`poolId`, `npcUserId`, `strategy`): `Promise`\<`number`\>

Defined in: [src/lib/npc/npc-investment-manager.ts:701](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc/npc-investment-manager.ts#L701)

Get recommended position size based on portfolio metrics and reputation

Combines portfolio utilization, risk score, and reputation to determine
optimal position size for new trades.

#### Parameters

##### poolId

`string`

Pool ID

##### npcUserId

`string`

NPC user ID

##### strategy

Investment strategy

`"aggressive"` | `"conservative"` | `"balanced"`

#### Returns

`Promise`\<`number`\>

Recommended position size as percentage of available balance
