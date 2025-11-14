/**
 * A2A Protocol Library
 * 
 * Core A2A protocol components for Next.js App Router
 */

// Client
export * from './client'

// Message Router (used by API routes)
export { MessageRouter } from './message-router'

// Services
export { getAnalysisService, AnalysisService } from './services/analysis-service'

// Blockchain
export { RegistryClient } from './blockchain/registry-client'

// Payments
export { X402Manager } from './payments/x402-manager'

// Utils
export { Logger } from './utils/logger'
export { RateLimiter } from './utils/rate-limiter'

