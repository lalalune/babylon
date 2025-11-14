[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/GameSimulator](../README.md) / GameSimulator

# Class: GameSimulator

Defined in: [src/engine/GameSimulator.ts:295](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L295)

Autonomous Game Simulator

 GameSimulator

## Description

Self-contained prediction market simulator that runs complete games from start
to finish without external input. Generates agents, clues, bets, and outcomes
autonomously.

**Architecture:**
- Extends EventEmitter for real-time event streaming
- All state maintained in memory (no database)
- Deterministic clue generation based on outcome
- LMSR market pricing with configurable liquidity

**Events Emitted:**
- `game:started` - Game initialization complete
- `day:changed` - New day begins
- `clue:distributed` - Agent receives clue
- `agent:bet` - Agent places bet
- `agent:post` - Agent posts to feed
- `market:updated` - Market prices change
- `outcome:revealed` - Game outcome revealed
- `game:ended` - Game complete

**Clue Network Design:**
- Early (Days 1-10): 70% accurate, some noise
- Mid (Days 11-20): 80% accurate, clearer signals
- Late (Days 21-30): 90%+ accurate, definitive information
- Distribution: Insiders get clues first, then spread

**Agent Decision Making:**
- Agents bet based on clues received
- YES/NO decision based on clue majority
- Bet amounts randomized (50-150 units)
- Bet frequency increases toward end (every 5 days early, more frequent late)

## Usage

Used for testing, simulation, and research. Not used in production gameplay.

## Example

```typescript
const simulator = new GameSimulator({ 
  outcome: true, 
  numAgents: 10,
  duration: 30,
  insiderPercentage: 0.4 
});

simulator.on('agent:bet', (event) => {
  console.log(`${event.data.agentId} bet on ${event.data.position}`);
});

const result = await simulator.runCompleteGame();
console.log(`Game complete: ${result.winners.length} winners`);
```

## Extends

- `EventEmitter`

## Constructors

### Constructor

> **new GameSimulator**(`config`): `GameSimulator`

Defined in: [src/engine/GameSimulator.ts:320](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L320)

Create a new game simulator

#### Parameters

##### config

[`GameConfig`](../interfaces/GameConfig.md)

Game configuration options

#### Returns

`GameSimulator`

#### Description

Initializes simulator with configuration. All optional values are set to
sensible defaults for balanced gameplay.

#### Example

```typescript
const sim = new GameSimulator({
  outcome: true,
  numAgents: 8,
  duration: 30,
  liquidityB: 150,
  insiderPercentage: 0.25
});
```

#### Overrides

`EventEmitter.constructor`

## Methods

### runCompleteGame()

> **runCompleteGame**(): `Promise`\<[`GameResult`](../interfaces/GameResult.md)\>

Defined in: [src/engine/GameSimulator.ts:390](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L390)

Run complete autonomous game simulation

#### Returns

`Promise`\<[`GameResult`](../interfaces/GameResult.md)\>

Complete game result with full event history

#### Throws

Never throws - all errors are logged and handled internally

#### Description

Executes a full 30-day prediction market game simulation from start to finish.
All agent decisions are autonomous based on clues and market state.

**Simulation Steps:**
1. **Setup**
   - Generate prediction question
   - Create agents (insiders + outsiders based on insiderPercentage)
   - Build clue network (21 total clues, distributed by reliability)

2. **Daily Loop** (30 days)
   - Distribute clues for current day
   - Agents make betting decisions based on knowledge
   - Update market prices via LMSR
   - Generate social posts (every 3 days)
   - Emit events for monitoring

3. **Resolution**
   - Reveal final outcome
   - Calculate winners (agents who bet correctly)
   - Update reputation (+10 winners, -5 losers)

**Performance:**
- Typical runtime: 100-500ms (no LLM calls)
- Memory usage: ~1-2MB per game
- Event count: 200-500 events per game

**Event Streaming:**
Listen to events for real-time updates:
```typescript
sim.on('day:changed', (event) => { ... });
sim.on('agent:bet', (event) => { ... });
```

#### Example

```typescript
const sim = new GameSimulator({ outcome: true, numAgents: 10 });
const result = await sim.runCompleteGame();

console.log(`Question: ${result.question}`);
console.log(`Outcome: ${result.outcome ? 'YES' : 'NO'}`);
console.log(`Duration: ${result.endTime - result.startTime}ms`);
console.log(`Events: ${result.events.length}`);
console.log(`Winners: ${result.winners.length}/${result.agents.length}`);

// Analyze market evolution
const finalPrices = result.market;
console.log(`Final YES price: ${finalPrices.yesOdds}%`);
console.log(`Total volume: $${finalPrices.totalVolume}`);
```
