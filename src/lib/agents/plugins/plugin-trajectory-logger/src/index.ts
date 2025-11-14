import { type Plugin } from '@elizaos/core';

// Note: TrajectoryLoggerService is exported below but not registered as a service
// since it doesn't fully implement the Service interface yet (placeholder implementation)

export const trajectoryLoggerPlugin: Plugin = {
  name: '@elizaos/plugin-trajectory-logger',
  description:
    'Collects complete agent interaction trajectories for RL training. Records LLM calls, provider access, actions, environment state, and computes rewards from game knowledge.',
  dependencies: [],
  services: [],
};

export default trajectoryLoggerPlugin;

// ==========================================
// CORE TYPES
// ==========================================
export * from './types';
export { TrajectoryLoggerService } from './TrajectoryLoggerService';

// ==========================================
// PRIMARY: Action-Level Instrumentation
// Use these for most cases!
// ==========================================
export * from './action-interceptor';
// Exports:
// - wrapActionWithLogging()
// - wrapPluginActions()
// - logLLMCallFromAction()
// - logProviderFromAction()

// ==========================================
// PRIMARY: Game-Knowledge Rewards
// Use this if you have perfect game information!
// ==========================================
export * from './game-rewards';
// Exports:
// - computeTrajectoryReward()
// - computeStepReward()
// - buildGameStateFromDB()
// - recomputeTrajectoryRewards()

// ==========================================
// ART FORMAT CONVERSION
// Converts rich trajectories to ART message format
// ==========================================
export * from './art-format';
// Exports:
// - toARTMessages() - Convert to message array
// - toARTTrajectory() - Convert to ART format
// - groupTrajectories() - Group by scenario
// - prepareForRULER() - Format for LLM judge
// - validateARTCompatibility() - Check convertibility

// ==========================================
// DATA EXPORT
// ==========================================
export * from './export';
// Exports:
// - exportToHuggingFace()
// - exportGroupedByScenario()
// - exportForOpenPipeART()
// - exportGroupedForGRPO() - Groups for RULER ranking

// ==========================================
// ADVANCED: Manual Instrumentation
// Only use if you need custom control beyond actions
// ==========================================
export * from './integration';
// Exports:
// - startAutonomousTick()
// - endAutonomousTick()
// - loggedLLMCall()
// - logProviderAccess()
// - withTrajectoryLogging()

// ==========================================
// OPTIONAL: AI Judge Rewards
// Only use if you DON'T have game knowledge
// (game-rewards.ts is usually better!)
// ==========================================
export * from './reward-service';
// Exports:
// - RewardService
// - createRewardService()
// - scoreTrajectory()
// - scoreTrajectoryGroup() (RULER)
