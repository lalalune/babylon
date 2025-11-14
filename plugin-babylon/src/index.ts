/**
 * @babylonai/plugin-babylon
 *
 * ElizaOS plugin for autonomous AI agents to participate in Babylon prediction markets
 * Following latest ElizaOS plugin architecture patterns
 */

// Import plugin and services first
import {
  predictionMarketsPlugin,
  BabylonClientService,
  BabylonTradingService,
} from "./plugin";
import { SocialInteractionService } from "./services/services";
import { BabylonChatService } from "./services/chat-service";
import { BabylonA2AService } from "./a2a-service";
import { Agent0Service } from "./agent0-service";
import { BabylonDiscoveryService } from "./discovery-service";

// Export plugin and services (following quick-starter pattern)
export { 
  predictionMarketsPlugin, 
  BabylonClientService, 
  BabylonTradingService,
  SocialInteractionService,
  BabylonChatService,
  BabylonA2AService,
  Agent0Service,
  BabylonDiscoveryService,
};

// Export types and utilities for external use
export * from "./types";
export * from "./api-client";
export * from "./agent-auth-service";
export * from "./actions/actions";
export * from "./evaluators/evaluators";
export * from "./providers/providers";
export * from "./environment";

// Legacy exports for backward compatibility
export const babylonGamePlugin = predictionMarketsPlugin;

// Default export
export default predictionMarketsPlugin;
