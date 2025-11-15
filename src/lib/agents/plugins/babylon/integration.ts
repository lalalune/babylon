/**
 * Babylon Plugin Integration Service - A2A SDK
 * 
 * Integrates the Babylon A2A plugin with the agent runtime manager
 * using @a2a-js/sdk
 * 
 * This file re-exports the SDK implementation to maintain
 * backward compatibility with existing code.
 */

// Re-export from A2A SDK integration
export {
  initializeAgentA2AClient,
  enhanceRuntimeWithBabylon,
  disconnectAgentA2AClient,
  hasActiveA2AConnection,
  BabylonA2AClient
} from './integration-a2a-sdk'

