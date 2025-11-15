/**
 * A2A Protocol Exports
 * 
 * Babylon implements the official A2A protocol using @a2a-js/sdk
 * All A2A operations use the standard message/send, tasks/get, etc. methods
 * 
 * Endpoint: /api/a2a
 * 
 * For client usage, use A2AClient from @a2a-js/sdk/client
 * See examples/a2a-agent0/ for usage examples
 */

// Validation schemas
export * from './validation'

// Utilities
export * from './utils'

// Services
export * from './services'

// Blockchain integration
export * from './blockchain'

// Payment handling
export * from './payments'

// Handlers (escrow operations)
export * from './handlers/escrow-handlers'

// A2A Protocol Implementation (using @a2a-js/sdk)
export { babylonAgentCard } from './babylon-agent-card'
export { BabylonAgentExecutor } from './executors/babylon-executor'
export { BabylonAgentExecutor as BabylonExecutor } from './executors/babylon-executor'
export { ExtendedTaskStore } from './extended-task-store'
export type { ListTasksParams, ListTasksResult } from './extended-task-store'

// Agent card generator for per-agent cards
export { generateAgentCard, generateAgentCardSync } from './sdk/agent-card-generator'

// Note: For client usage, use A2AClient from @a2a-js/sdk/client
// See examples/a2a-agent0/ for usage examples
