/**
 * IPFS Metadata Fetcher
 * 
 * Fetches agent metadata from IPFS via HTTP gateways.
 * Publishing is handled by Agent0 SDK (agent.registerIPFS()).
 * 
 * This is a lightweight wrapper for IPFS gateway access only.
 */

import { logger } from '@/lib/logger'
import { z } from 'zod'

export const AgentMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  image: z.string().optional(),
  version: z.string(),
  type: z.string().optional(),
  endpoints: z.object({
    mcp: z.string().optional(),
    a2a: z.string().optional(),
    api: z.string().optional(),
    docs: z.string().optional(),
    websocket: z.string().optional(),
  }),
  capabilities: z.object({
    strategies: z.array(z.string()).optional(),
    markets: z.array(z.string()),
    actions: z.array(z.string()),
    tools: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    protocols: z.array(z.string()).optional(),
    socialFeatures: z.boolean().optional(),
    realtime: z.boolean().optional(),
    authentication: z.array(z.string()).optional(),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  mcp: z.object({
    tools: z.array(z.object({
      name: z.string(),
      description: z.string(),
      inputSchema: z.record(z.string(), z.unknown()),
    })),
  }).optional(),
  babylon: z.object({
    agentId: z.string().optional(),
    tokenId: z.number().optional(),
    walletAddress: z.string().optional(),
    registrationTxHash: z.string().optional(),
  }).optional(),
});
export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

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
    
    const metadata = await response.json()
    const validation = AgentMetadataSchema.safeParse(metadata);
    if (!validation.success) {
      logger.warn('Invalid agent metadata from IPFS', { cid, error: validation.error });
      throw new Error('Invalid agent metadata received from IPFS');
    }

    logger.debug(`Metadata fetched from IPFS gateway: ${cid}`, undefined, 'IPFSPublisher')
    return validation.data
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

