[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/reputation-service](../README.md) / calculateReputationScore

# Function: calculateReputationScore()

> **calculateReputationScore**(`normalizedPnL`, `averageFeedbackScore`, `gamesPlayed`): `number`

Defined in: [src/lib/reputation/reputation-service.ts:78](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/reputation-service.ts#L78)

Calculate composite reputation score for a user/agent

Weighted composite formula:
Reputation = (PNL * 0.4) + (Feedback * 0.4) + (Activity * 0.2)

Components:
- PNL (40%): Normalized profit/loss performance (0-100)
- Feedback (40%): Average feedback score from others (0-100)
- Activity (20%): Games/interactions played (0-100, capped at 50 games)

## Parameters

### normalizedPnL

`number`

PNL normalized to 0-1 scale

### averageFeedbackScore

`number`

Average feedback score (0-100)

### gamesPlayed

`number`

Number of games played

## Returns

`number`

Composite reputation score (0-100)
