[**babylon v0.1.0**](../../README.md)

***

[babylon](../../README.md) / engine/GameSimulator

# engine/GameSimulator

Babylon Game Simulator - Autonomous Prediction Market Simulator

## Description

Fully autonomous simulation of prediction market games from start to finish.
Generates complete 30-day game narratives with agents, clues, bets, and outcomes
without any human intervention.

**Key Features:**
- Predetermined outcome that agents discover over time
- Insider agents with privileged information
- Clue distribution system (early/mid/late game)
- LMSR (Logarithmic Market Scoring Rule) for pricing
- Event-driven architecture with full event logging
- Social interactions and agent conversations
- Reputation system with win/loss tracking

**Simulation Flow:**
1. Setup: Generate question, create agents (insiders + outsiders), build clue network
2. Daily Loop (30 days):
   - Distribute clues to agents
   - Agents make betting decisions based on knowledge
   - Market prices update via LMSR
   - Social posts and interactions
3. Resolution: Reveal outcome, calculate winners, update reputation

**Use Cases:**
- Testing game mechanics without UI
- Generating training data for ML models
- Simulating market dynamics
- Stress testing prediction markets
- Rapid prototyping of game rules

**NOT Used For:**
- Production game (use GameEngine instead)
- Real player interactions (no betting infrastructure)
- Persistent state (all state is in-memory)

## See

 - GameEngine - Production game engine with persistence
 - GameWorld - Event generation without betting

## Example

```typescript
const simulator = new GameSimulator({
  outcome: true,
  numAgents: 10,
  duration: 30,
  insiderPercentage: 0.3
});

const result = await simulator.runCompleteGame();
console.log(`Outcome: ${result.outcome ? 'YES' : 'NO'}`);
console.log(`${result.events.length} events generated`);
console.log(`${result.winners.length} winners`);
```

## Classes

- [GameSimulator](classes/GameSimulator.md)

## Interfaces

- [GameConfig](interfaces/GameConfig.md)
- [GameResult](interfaces/GameResult.md)
- [GameEvent](interfaces/GameEvent.md)
- [AgentState](interfaces/AgentState.md)
- [MarketState](interfaces/MarketState.md)
- [ReputationChange](interfaces/ReputationChange.md)

## Type Aliases

- [GameEventType](type-aliases/GameEventType.md)
- [GameEventData](type-aliases/GameEventData.md)
