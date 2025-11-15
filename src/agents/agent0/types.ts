/**
 * Agent0 Integration Type Definitions
 * 
 * Type-safe interfaces for Agent0 SDK integration
 */

import type { AgentProfile, AgentCapabilities } from '@/types/a2a'

/**
 * Agent0 Client Interface
 * Defines the methods available on Agent0Client for external use
 */
export interface IAgent0Client {
  registerAgent(params: Agent0RegistrationParams): Promise<Agent0RegistrationResult>
  registerBabylonGame(): Promise<Agent0RegistrationResult>
  updateAgent(tokenId: number, params: Partial<Agent0UpdateParams>): Promise<Agent0UpdateResult>
  deactivateAgent(tokenId: number): Promise<void>
  reactivateAgent(tokenId: number): Promise<void>
  transferAgent(tokenId: number, newOwnerAddress: string): Promise<Agent0TransferResult>
  batchRegisterAgents(params: Agent0RegistrationParams[]): Promise<Agent0BatchResult>
  batchUpdateAgents(updates: Array<{ tokenId: number; params: Partial<Agent0UpdateParams> }>): Promise<Agent0BatchResult>
  searchAgents(filters: Agent0SearchFilters): Promise<Agent0SearchResult[]>
  submitFeedback(params: Agent0FeedbackParams): Promise<void>
  getAgentProfile(tokenId: number): Promise<Agent0AgentProfile | null>
  getAgentHistory(tokenId: number): Promise<Agent0HistoryEntry[]>
  isAvailable(): boolean
}

/**
 * Unified Discovery Service Interface
 * Defines the methods available on UnifiedDiscoveryService
 */
export interface IUnifiedDiscoveryService {
  discoverAgents(filters: DiscoveryFilters): Promise<AgentProfile[]>
  getAgent(agentId: string): Promise<AgentProfile | null>
}

/**
 * Agent0 Registration Parameters
 */
export interface Agent0RegistrationParams {
  name: string
  description: string
  imageUrl?: string
  walletAddress: string
  mcpEndpoint?: string
  a2aEndpoint?: string
  capabilities: AgentCapabilities
}

/**
 * Agent0 Registration Result
 */
export interface Agent0RegistrationResult {
  tokenId: number
  txHash: string
  metadataCID?: string
}

/**
 * Agent0 Search Filters
 */
export interface Agent0SearchFilters {
  name?: string
  strategies?: string[]
  markets?: string[]
  minReputation?: number
  x402Support?: boolean
  hasX402?: boolean // Legacy, use x402Support instead
  type?: string
}

/**
 * Agent0 Search Result
 */
export interface Agent0SearchResult {
  tokenId: number
  name: string
  walletAddress: string
  metadataCID: string
  capabilities: AgentCapabilities
  reputation: {
    trustScore: number
    accuracyScore: number
  }
}

/**
 * Agent0 Agent Profile
 */
export interface Agent0AgentProfile {
  tokenId: number
  name: string
  walletAddress: string
  metadataCID: string
  capabilities: AgentCapabilities
  reputation: {
    trustScore: number
    accuracyScore: number
  }
}

/**
 * Agent0 Feedback Parameters
 */
export interface Agent0FeedbackParams {
  targetAgentId: number
  rating: number  // -5 to +5
  comment: string
  transactionId?: string  // Optional local transaction/feedback ID for tracking
}

/**
 * Agent0 Update Parameters
 */
export interface Agent0UpdateParams {
  name?: string
  description?: string
  imageUrl?: string | null
  walletAddress?: string | null
  mcpEndpoint?: string
  a2aEndpoint?: string
  capabilities?: AgentCapabilities
}

/**
 * Agent0 Update Result
 */
export interface Agent0UpdateResult {
  tokenId: number
  txHash: string
  metadataCID?: string
  updatedAt: number
}

/**
 * Agent0 Transfer Result
 */
export interface Agent0TransferResult {
  tokenId: number
  oldOwner: string
  newOwner: string
  txHash: string
  transferredAt: number
}

/**
 * Agent0 History Entry
 */
export interface Agent0HistoryEntry {
  type: 'registration' | 'update' | 'transfer' | 'deactivation' | 'reactivation' | 'feedback'
  timestamp: number
  txHash?: string
  metadataCID?: string
  details: Record<string, unknown>
}

/**
 * Agent0 Batch Operation Result
 */
export interface Agent0BatchResult {
  successful: Array<{
    index: number
    tokenId?: number
    txHash: string
    metadataCID?: string
  }>
  failed: Array<{
    index: number
    error: string
  }>
  totalProcessed: number
  successCount: number
  failureCount: number
}

/**
 * Discovery Filters for UnifiedDiscoveryService
 */
export interface DiscoveryFilters {
  strategies?: string[]
  markets?: string[]
  minReputation?: number
  includeExternal?: boolean
  semanticQuery?: string // Semantic/vector search query
  capabilities?: string[] // Specific capabilities to search for
  maxResults?: number
  sortBy?: 'reputation' | 'recent' | 'activity'
}

/**
 * Aggregated Reputation from Multiple Sources
 */
export interface AggregatedReputation {
  totalBets: number
  winningBets: number
  accuracyScore: number
  trustScore: number
  totalVolume: string
  profitLoss: number
  isBanned: boolean
  sources: {
    local: number  // Trust score from ERC-8004
    agent0: number  // Trust score from Agent0 network
  }
}

/**
 * Reputation Bridge Interface
 * Aggregates reputation from multiple sources
 */
export interface IReputationBridge {
  getAggregatedReputation(tokenId: number): Promise<AggregatedReputation>
}

