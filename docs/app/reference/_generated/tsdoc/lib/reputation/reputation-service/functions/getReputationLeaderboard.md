[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/reputation-service](../README.md) / getReputationLeaderboard

# Function: getReputationLeaderboard()

> **getReputationLeaderboard**(`limit`, `minGames`): `Promise`\<`object`[]\>

Defined in: [src/lib/reputation/reputation-service.ts:389](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/reputation-service.ts#L389)

Get leaderboard of top-rated agents

## Parameters

### limit

`number` = `100`

Number of agents to return

### minGames

`number` = `5`

Minimum games played to qualify

## Returns

`Promise`\<`object`[]\>

Array of agents sorted by reputation score
