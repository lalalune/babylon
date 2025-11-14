[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/agent0-reputation-sync](../README.md) / getReputationForAgent0Metadata

# Function: getReputationForAgent0Metadata()

> **getReputationForAgent0Metadata**(`userId`): `Promise`\<\{ `reputation`: \{ `score`: `number`; `trustLevel`: `string`; `confidence`: `number`; `gamesPlayed`: `number`; `winRate`: `number`; `normalizedPnL?`: `undefined`; `averageFeedbackScore?`: `undefined`; `totalFeedback?`: `undefined`; \}; \} \| \{ `reputation`: \{ `score`: `number`; `trustLevel`: `string`; `confidence`: `number`; `gamesPlayed`: `number`; `winRate`: `number`; `normalizedPnL`: `number`; `averageFeedbackScore`: `number`; `totalFeedback`: `number`; \}; \} \| \{ `reputation`: \{ `gamesPlayed?`: `undefined`; `winRate?`: `undefined`; `normalizedPnL?`: `undefined`; `averageFeedbackScore?`: `undefined`; `totalFeedback?`: `undefined`; `score`: `number`; `trustLevel`: `string`; `confidence`: `number`; \}; \}\>

Defined in: [src/lib/reputation/agent0-reputation-sync.ts:303](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/agent0-reputation-sync.ts#L303)

Enhance Agent0 registration metadata with reputation data

Includes current reputation score and trust level in Agent0 metadata
when registering or updating agent profile.

## Parameters

### userId

`string`

User ID

## Returns

`Promise`\<\{ `reputation`: \{ `score`: `number`; `trustLevel`: `string`; `confidence`: `number`; `gamesPlayed`: `number`; `winRate`: `number`; `normalizedPnL?`: `undefined`; `averageFeedbackScore?`: `undefined`; `totalFeedback?`: `undefined`; \}; \} \| \{ `reputation`: \{ `score`: `number`; `trustLevel`: `string`; `confidence`: `number`; `gamesPlayed`: `number`; `winRate`: `number`; `normalizedPnL`: `number`; `averageFeedbackScore`: `number`; `totalFeedback`: `number`; \}; \} \| \{ `reputation`: \{ `gamesPlayed?`: `undefined`; `winRate?`: `undefined`; `normalizedPnL?`: `undefined`; `averageFeedbackScore?`: `undefined`; `totalFeedback?`: `undefined`; `score`: `number`; `trustLevel`: `string`; `confidence`: `number`; \}; \}\>

Enhanced metadata object
