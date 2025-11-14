/**
 * Babylon Plugin Service Exports
 * 
 * Re-exports autonomous services that use the Babylon A2A plugin
 */

export { autonomousA2AService, AutonomousA2AService } from '../../autonomous/AutonomousA2AService'
export { 
  initializeAgentA2AClient, 
  enhanceRuntimeWithBabylon, 
  disconnectAgentA2AClient, 
  hasActiveA2AConnection 
} from './integration'

