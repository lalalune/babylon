/**
 * IPFS Metadata Fetcher
 * 
 * Fetches agent metadata from IPFS via HTTP gateways.
 * Publishing is handled by Agent0 SDK (agent.registerIPFS()).
 * 
 * This is a lightweight wrapper for IPFS gateway access only.
 */

import { logger } from '@/lib/logger'

export interface AgentMetadata {
  name: string
  description: string
  image?: string
  version: string
  type?: string  // "game-platform", "agent", "user"
  endpoints: {
    mcp?: string
    a2a?: string
    api?: string
    docs?: string
    websocket?: string
  }
  capabilities: {
    strategies?: string[]
    markets: string[]
    actions: string[]
    tools?: string[]  // MCP tools
    skills?: string[]  // A2A skills
    protocols?: string[]
    socialFeatures?: boolean
    realtime?: boolean
    authentication?: string[]
  }
  metadata?: {
    [key: string]: unknown
  }
  mcp?: {
    tools: Array<{
      name: string
      description: string
      inputSchema: Record<string, unknown>
    }>
  }
  babylon?: {
    agentId?: string
    tokenId?: number
    walletAddress?: string
    registrationTxHash?: string
  }
}

export class IPFSPublisher {
  /**
   * No initialization needed - we only fetch via HTTP gateway
   * Publishing is handled by Agent0 SDK
   */
  constructor() {
    logger.debug('IPFSPublisher initialized (gateway-only mode)', undefined, 'IPFSPublisher')
  }
  
  /**
   * Fetch metadata from IPFS by CID via HTTP gateway
   * Simple and reliable - no IPFS node needed
   */
  async fetchMetadata(cid: string): Promise<AgentMetadata> {
    const gatewayUrl = this.getGatewayUrl(cid)
    const response = await fetch(gatewayUrl, {
      headers: { 'Accept': 'application/json' }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS gateway: ${response.status} ${response.statusText}`)
    }
    
    const metadata = await response.json() as AgentMetadata
    logger.debug(`Metadata fetched from IPFS gateway: ${cid}`, undefined, 'IPFSPublisher')
    return metadata
  }
  
  /**
   * Get IPFS gateway URL for a CID
   */
  getGatewayUrl(cid: string): string {
    const gateway = process.env.AGENT0_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'
    return `${gateway}${cid}`
  }
  
  /**
   * Check if IPFS gateway is available
   * Always returns true since we use public gateway
   */
  isAvailable(): boolean {
    return true
  }
  
  /**
   * Publish metadata to IPFS
   * DEPRECATED: Use Agent0Client.registerAgent() instead
   * Agent0 SDK handles IPFS publishing via agent.registerIPFS()
   */
  async publishMetadata(_metadata: AgentMetadata): Promise<string> {
    throw new Error(
      'Direct IPFS publishing is deprecated. Use Agent0Client.registerAgent() instead. ' +
      'The Agent0 SDK handles IPFS publishing automatically via agent.registerIPFS().'
    )
  }
}

