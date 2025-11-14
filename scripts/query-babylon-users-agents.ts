/**
 * Query all users and agents registered to Babylon via Agent0 subgraph
 * Network: Ethereum Sepolia
 * Registry: Agent0 Official Registry (0x8004a6090Cd10A7288092483047B097295Fb8847)
 */

const AGENT0_SUBGRAPH_URL = 'https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT'

interface AgentMetadata {
  key: string
  value: string
}

interface Agent {
  id: string
  chainId: string
  agentId: string
  agentURI: string | null
  owner: string
  createdAt: string
  totalFeedback: string
  metadata: AgentMetadata[]
}

interface QueryResponse {
  data: {
    agents: Agent[]
  }
}

// Decode hex metadata value
function decodeHex(hex: string): string {
  if (!hex.startsWith('0x')) return hex
  const hexString = hex.slice(2)
  const bytes = Buffer.from(hexString, 'hex')
  return bytes.toString('utf8')
}

// Parse metadata array into object
function parseMetadata(metadata: AgentMetadata[]): Record<string, any> {
  const result: Record<string, any> = {}
  
  for (const item of metadata) {
    const decoded = decodeHex(item.value)
    
    // Try to parse as JSON
    if (decoded.startsWith('{') || decoded.startsWith('[')) {
      try {
        result[item.key] = JSON.parse(decoded)
      } catch {
        result[item.key] = decoded
      }
    } else {
      result[item.key] = decoded
    }
  }
  
  return result
}

async function queryBabylonUsersAndAgents() {
  console.log('🔍 Querying Babylon Users & Agents from Agent0 Subgraph...\n')
  console.log('📋 Subgraph Details:')
  console.log(`   Network: Ethereum Sepolia`)
  console.log(`   Registry: 0x8004a6090Cd10A7288092483047B097295Fb8847`)
  console.log(`   Subgraph: ${AGENT0_SUBGRAPH_URL}\n`)

  // Query for all agents (including Babylon game itself)
  const query = `
    {
      agents(first: 1000, orderBy: agentId, orderDirection: desc) {
        id
        chainId
        agentId
        agentURI
        owner
        createdAt
        totalFeedback
        metadata {
          key
          value
        }
      }
    }
  `

  try {
    const response = await fetch(AGENT0_SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: QueryResponse = await response.json()
    const allAgents = result.data.agents

    console.log(`✅ Found ${allAgents.length} total agents on Agent0\n`)

    // Filter only Babylon-related agents (platform: 'babylon')
    const babylonGame = allAgents.find(a => {
      const meta = parseMetadata(a.metadata)
      return meta.type === 'game-platform' || a.agentId === '989'
    })

    const babylonUsers = allAgents.filter(a => {
      const meta = parseMetadata(a.metadata)
      return meta.capabilities?.platform === 'babylon' && meta.capabilities?.userType === 'player'
    })

    const babylonAgents = allAgents.filter(a => {
      const meta = parseMetadata(a.metadata)
      return meta.capabilities?.platform === 'babylon' && meta.capabilities?.userType === 'agent'
    })

    // Display Babylon Game
    if (babylonGame) {
      console.log('🎮 Babylon Game Platform\n')
      console.log('─'.repeat(80))
      const meta = parseMetadata(babylonGame.metadata)
      console.log(`   Token ID: ${babylonGame.agentId}`)
      console.log(`   Owner: ${babylonGame.owner}`)
      console.log(`   Type: ${meta.type || 'N/A'}`)
      console.log(`   Version: ${meta.version || 'N/A'}`)
      console.log(`   Agent URI: ${babylonGame.agentURI}`)
      console.log(`   Registered: ${new Date(Number(babylonGame.createdAt) * 1000).toISOString()}`)
      
      if (meta.capabilities) {
        console.log(`   Markets: ${meta.capabilities.markets?.join(', ') || 'N/A'}`)
        console.log(`   Protocols: ${meta.capabilities.protocols?.join(', ') || 'N/A'}`)
        console.log(`   Actions: ${meta.capabilities.actions?.length || 0} available`)
      }
      console.log('─'.repeat(80))
      console.log()
    }

    // Display Babylon Users
    if (babylonUsers.length > 0) {
      console.log(`👥 Babylon Users (${babylonUsers.length})\n`)
      console.log('─'.repeat(80))
      
      for (const user of babylonUsers.slice(0, 10)) { // Show first 10
        const meta = parseMetadata(user.metadata)
        console.log(`\n   🧑 User #${user.agentId}`)
        console.log(`      Owner: ${user.owner}`)
        console.log(`      Type: ${meta.type || 'user'}`)
        console.log(`      Wallet: ${meta.agentWallet || 'N/A'}`)
        console.log(`      Registered: ${new Date(Number(user.createdAt) * 1000).toISOString()}`)
        
        if (meta.capabilities) {
          console.log(`      Actions: ${meta.capabilities.actions?.length || 0} available`)
        }
      }
      
      if (babylonUsers.length > 10) {
        console.log(`\n   ... and ${babylonUsers.length - 10} more users`)
      }
      
      console.log('\n' + '─'.repeat(80))
      console.log()
    }

    // Display Babylon Agents
    if (babylonAgents.length > 0) {
      console.log(`🤖 Babylon Autonomous Agents (${babylonAgents.length})\n`)
      console.log('─'.repeat(80))
      
      for (const agent of babylonAgents.slice(0, 10)) { // Show first 10
        const meta = parseMetadata(agent.metadata)
        console.log(`\n   🤖 Agent #${agent.agentId}`)
        console.log(`      Owner: ${agent.owner}`)
        console.log(`      Type: ${meta.type || 'agent'}`)
        console.log(`      Wallet: ${meta.agentWallet || 'N/A'}`)
        console.log(`      Registered: ${new Date(Number(agent.createdAt) * 1000).toISOString()}`)
        
        if (meta.capabilities) {
          console.log(`      Actions: ${meta.capabilities.actions?.length || 0} available`)
        }
      }
      
      if (babylonAgents.length > 10) {
        console.log(`\n   ... and ${babylonAgents.length - 10} more agents`)
      }
      
      console.log('\n' + '─'.repeat(80))
      console.log()
    }

    // Summary
    console.log('\n📊 Summary:')
    console.log(`   🎮 Babylon Game: ${babylonGame ? '✅ Registered' : '❌ Not Found'}`)
    console.log(`   👥 Babylon Users: ${babylonUsers.length}`)
    console.log(`   🤖 Babylon Agents: ${babylonAgents.length}`)
    console.log(`   🌐 Total Agents on Agent0: ${allAgents.length}`)
    console.log()
    console.log('✅ Query complete!')

  } catch (error) {
    console.error('❌ Error querying subgraph:', error)
    throw error
  }
}

// Run the query
queryBabylonUsersAndAgents().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

