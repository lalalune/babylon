/**
 * Unit Tests for IPFSPublisher
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { IPFSPublisher, type AgentMetadata } from '../IPFSPublisher'

describe('IPFSPublisher', () => {
  let publisher: IPFSPublisher
  
  beforeEach(() => {
    publisher = new IPFSPublisher()
  })
  
  test('can be instantiated', () => {
    expect(publisher).toBeDefined()
  })
  
  test('isAvailable returns boolean', () => {
    const available = publisher.isAvailable()
    expect(typeof available).toBe('boolean')
  })
  
  test('getGatewayUrl returns valid URL', () => {
    const cid = 'QmTest123'
    const url = publisher.getGatewayUrl(cid)
    
    expect(url).toContain(cid)
    expect(url.startsWith('http')).toBe(true)
  })
  
  test('can create valid agent metadata structure', () => {
    const metadata: AgentMetadata = {
      name: 'Test Agent',
      description: 'Test description',
      version: '1.0.0',
      type: 'agent',
      endpoints: {
        a2a: 'wss://test.com/ws',
        api: 'https://test.com/api'
      },
      capabilities: {
        markets: ['prediction'],
        actions: ['trade'],
        version: '1.0.0'
      }
    }
    
    expect(metadata.name).toBe('Test Agent')
    expect(metadata.endpoints.a2a).toBe('wss://test.com/ws')
    expect(metadata.capabilities.markets).toContain('prediction')
  })
  
  test('publishMetadata is deprecated and directs to Agent0 SDK', async () => {
    // publishMetadata is intentionally deprecated
    // It should throw an error directing developers to use Agent0Client.registerAgent()
    await expect(
      publisher.publishMetadata({
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
        endpoints: {},
        capabilities: { markets: [], actions: [], version: '1.0.0' }
      })
    ).rejects.toThrow('Use Agent0Client.registerAgent() instead')
  })
  
  test('isAvailable always returns true (gateway-only mode)', () => {
    // In gateway-only mode, we're always "available" since we use public gateway
    expect(publisher.isAvailable()).toBe(true)
  })
})

