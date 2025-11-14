/**
 * Snowflake ID Generation Test
 * 
 * Tests the distributed ID generation system
 */

import { describe, test, expect } from 'bun:test'
import { generateSnowflakeId } from '@/lib/snowflake'

describe('Snowflake IDs', () => {
  test('Generate unique IDs', async () => {
    const id1 = await generateSnowflakeId()
    const id2 = await generateSnowflakeId()
    
    expect(id1).not.toBe(id2)
    expect(id1.length).toBeGreaterThan(10)
    expect(id2.length).toBeGreaterThan(10)
  })

  test('IDs are sortable by timestamp', async () => {
    const id1 = await generateSnowflakeId()
    const id2 = await generateSnowflakeId()
    
    expect(id2 > id1).toBe(true)
  })

  test('IDs are unique identifier strings', async () => {
    const id = await generateSnowflakeId()
    
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(10)
    expect(/^[0-9]+$/.test(id)).toBe(true) // Should be numeric string
  })

  test('Generate many unique IDs rapidly', async () => {
    const ids = new Set<string>()
    const count = 1000
    
    for (let i = 0; i < count; i++) {
      ids.add(await generateSnowflakeId())
    }
    
    expect(ids.size).toBe(count)
  })
})

