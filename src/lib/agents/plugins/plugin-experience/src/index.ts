import type { Plugin } from '@elizaos/core';
import { ExperienceService } from './service';
import { experienceProvider } from './providers/experienceProvider';
import { experienceEvaluator } from './evaluators/experienceEvaluator';
import type { IAgentRuntime } from '@elizaos/core';
import { logger } from '@elizaos/core';
import './types'; // Ensure module augmentation is loaded

export const experiencePlugin: Plugin = {
  name: 'experience',
  description:
    'Self-learning experience system that records experiences and learns from agent interactions',

  services: [ExperienceService],

  providers: [experienceProvider],

  evaluators: [experienceEvaluator],

  init: async (config: Record<string, unknown>, runtime: IAgentRuntime) => {
    void runtime; // Runtime currently unused during initialization

    logger.info('[ExperiencePlugin] Initializing self-learning experience system');

    const maxExperiences = config.maxExperiences as number || 10000;
    const autoRecordThreshold = config.autoRecordThreshold as number || 0.7;

    logger.info(`[ExperiencePlugin] Configuration read:
    - Max experiences: ${maxExperiences}
    - Auto-record threshold: ${autoRecordThreshold}`);
  },
};

// Export individual components for testing
export { ExperienceService } from './service';
export * from './types';

export default experiencePlugin;
