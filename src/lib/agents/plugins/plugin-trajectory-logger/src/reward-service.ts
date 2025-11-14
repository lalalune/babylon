/**
 * AI Judge Rewards
 * 
 * Use AI judge to score trajectories when game knowledge isn't available
 */

import type { Trajectory } from './types';

export class RewardService {
  /**
   * Score a single trajectory
   */
  async scoreTrajectory(_trajectory: Trajectory): Promise<number> {
    // Placeholder implementation
    return 0;
  }

  /**
   * Score a trajectory group (RULER)
   */
  async scoreTrajectoryGroup(trajectories: Trajectory[]): Promise<number[]> {
    // Placeholder implementation
    return trajectories.map(() => 0);
  }
}

/**
 * Create reward service
 */
export function createRewardService(): RewardService {
  return new RewardService();
}

/**
 * Score trajectory
 */
export async function scoreTrajectory(
  trajectory: Trajectory
): Promise<number> {
  const service = new RewardService();
  return service.scoreTrajectory(trajectory);
}

/**
 * Score trajectory group
 */
export async function scoreTrajectoryGroup(
  trajectories: Trajectory[]
): Promise<number[]> {
  const service = new RewardService();
  return service.scoreTrajectoryGroup(trajectories);
}

