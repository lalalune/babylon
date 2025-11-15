/**
 * Test Script for Per-Agent A2A Server
 * 
 * Creates a test agent, enables A2A, and tests all endpoints
 */

import { prisma } from '../src/lib/prisma'
import { generateSnowflakeId } from '../src/lib/snowflake'
import { ethers } from 'ethers'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function testAgentA2AServer() {
  console.log('\n🧪 Testing Per-Agent A2A Server Implementation\n')
  console.log('='.repeat(60))

  // Step 1: Create a test agent
  console.log('\n📝 Step 1: Creating test agent...')
  const privateKey = process.env.AGENT_DEFAULT_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey
  const wallet = new ethers.Wallet(privateKey)
  const agentId = await generateSnowflakeId()

  // Clean up any existing test agent with this wallet
  await prisma.user.deleteMany({
    where: { walletAddress: wallet.address }
  })

  const testAgent = await prisma.user.create({
    data: {
      id: agentId,
      username: `test_a2a_${Date.now()}`,
      displayName: 'A2A Test Agent',
      walletAddress: wallet.address,
      isAgent: true,
      a2aEnabled: false, // Start with A2A disabled
      autonomousTrading: true,
      virtualBalance: 10000,
      agentSystem: 'You are a test agent for A2A server testing',
      agentModelTier: 'free',
      hasUsername: true,
      profileComplete: true,
      updatedAt: new Date()
    }
  })

  console.log(`✅ Created test agent: ${testAgent.id}`)
  console.log(`   Username: @${testAgent.username}`)
  console.log(`   Wallet: ${testAgent.walletAddress}`)
  console.log(`   A2A Enabled: ${testAgent.a2aEnabled}`)

  // Step 2: Test agent card endpoint (should fail when disabled)
  console.log('\n📋 Step 2: Testing agent card endpoint (A2A disabled)...')
  try {
    const cardResponse = await fetch(`${BASE_URL}/api/agents/${agentId}/.well-known/agent-card`)
    if (cardResponse.status === 403) {
      console.log('✅ Correctly returns 403 when A2A is disabled')
    } else {
      console.log(`⚠️  Expected 403, got ${cardResponse.status}`)
    }
  } catch (error) {
    console.log(`⚠️  Error testing agent card: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Step 3: Test A2A server endpoint (should fail when disabled)
  console.log('\n🔌 Step 3: Testing A2A server endpoint (A2A disabled)...')
  try {
    const a2aResponse = await fetch(`${BASE_URL}/api/agents/${agentId}/a2a`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tasks/list',
        id: 1
      })
    })
    if (a2aResponse.status === 403) {
      console.log('✅ Correctly returns 403 when A2A is disabled')
    } else {
      console.log(`⚠️  Expected 403, got ${a2aResponse.status}`)
    }
  } catch (error) {
    console.log(`⚠️  Error testing A2A server: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Step 4: Enable A2A
  console.log('\n🔓 Step 4: Enabling A2A for agent...')
  const updatedAgent = await prisma.user.update({
    where: { id: agentId },
    data: { a2aEnabled: true }
  })
  console.log(`✅ A2A enabled: ${updatedAgent.a2aEnabled}`)

  // Step 5: Test agent card endpoint (should work now)
  console.log('\n📋 Step 5: Testing agent card endpoint (A2A enabled)...')
  try {
    const cardResponse = await fetch(`${BASE_URL}/api/agents/${agentId}/.well-known/agent-card`)
    if (cardResponse.ok) {
      const agentCard = await cardResponse.json()
      console.log('✅ Agent card endpoint works!')
      console.log(`   Name: ${agentCard.name}`)
      console.log(`   URL: ${agentCard.url}`)
      console.log(`   Skills: ${agentCard.skills?.length || 0}`)
    } else {
      console.log(`⚠️  Expected 200, got ${cardResponse.status}`)
    }
  } catch (error) {
    console.log(`⚠️  Error testing agent card: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Step 6: Test A2A server GET endpoint
  console.log('\n🔌 Step 6: Testing A2A server GET endpoint...')
  try {
    const getResponse = await fetch(`${BASE_URL}/api/agents/${agentId}/a2a`)
    if (getResponse.ok) {
      const info = await getResponse.json()
      console.log('✅ A2A server GET endpoint works!')
      console.log(`   Service: ${info.service}`)
      console.log(`   Status: ${info.status}`)
      console.log(`   Endpoint: ${info.endpoint}`)
    } else {
      console.log(`⚠️  Expected 200, got ${getResponse.status}`)
    }
  } catch (error) {
    console.log(`⚠️  Error testing A2A GET: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Step 7: Test A2A server POST endpoint (tasks/list)
  console.log('\n🔌 Step 7: Testing A2A server POST endpoint (tasks/list)...')
  try {
    const postResponse = await fetch(`${BASE_URL}/api/agents/${agentId}/a2a`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': 'test-requesting-agent'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tasks/list',
        params: { pageSize: 10 },
        id: 1
      })
    })
    
    if (postResponse.ok) {
      const result = await postResponse.json()
      console.log('✅ A2A server POST endpoint works!')
      console.log(`   JSON-RPC Version: ${result.jsonrpc}`)
      console.log(`   Has Result: ${!!result.result}`)
      if (result.result) {
        console.log(`   Tasks: ${result.result.tasks?.length || 0}`)
      }
    } else {
      const errorText = await postResponse.text()
      console.log(`⚠️  Expected 200, got ${postResponse.status}`)
      console.log(`   Response: ${errorText.substring(0, 200)}`)
    }
  } catch (error) {
    console.log(`⚠️  Error testing A2A POST: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Step 8: Test message/send endpoint
  console.log('\n💬 Step 8: Testing A2A server POST endpoint (message/send)...')
  try {
    const messageResponse = await fetch(`${BASE_URL}/api/agents/${agentId}/a2a`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': 'test-requesting-agent'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'message/send',
        params: {
          message: {
            role: 'user',
            parts: [{ kind: 'text', text: 'Hello, this is a test message' }]
          }
        },
        id: 2
      })
    })
    
    if (messageResponse.ok) {
      const result = await messageResponse.json()
      console.log('✅ A2A message/send endpoint works!')
      console.log(`   JSON-RPC Version: ${result.jsonrpc}`)
      console.log(`   Has Result: ${!!result.result}`)
    } else {
      const errorText = await messageResponse.text()
      console.log(`⚠️  Expected 200, got ${messageResponse.status}`)
      console.log(`   Response: ${errorText.substring(0, 200)}`)
    }
  } catch (error) {
    console.log(`⚠️  Error testing message/send: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Step 9: Verify API endpoint returns a2aEnabled
  console.log('\n📡 Step 9: Verifying API endpoint includes a2aEnabled...')
  try {
    // Note: This would require authentication in a real scenario
    // For now, we verify via database
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { a2aEnabled: true }
    })
    if (agent?.a2aEnabled === true) {
      console.log('✅ a2aEnabled field is correctly set in database')
    } else {
      console.log('⚠️  a2aEnabled field is not set correctly')
    }
  } catch (error) {
    console.log(`⚠️  Error verifying a2aEnabled: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('\n✅ Test Summary:')
  console.log(`   Agent ID: ${agentId}`)
  console.log(`   A2A Server URL: ${BASE_URL}/api/agents/${agentId}/a2a`)
  console.log(`   Agent Card URL: ${BASE_URL}/api/agents/${agentId}/.well-known/agent-card`)
  console.log('\n🧹 Cleaning up test agent...')
  
  await prisma.user.delete({
    where: { id: agentId }
  })
  
  console.log('✅ Test agent deleted')
  console.log('\n✨ All tests completed!\n')
}

testAgentA2AServer()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })

