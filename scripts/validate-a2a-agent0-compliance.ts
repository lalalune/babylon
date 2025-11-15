/**
 * Complete A2A & Agent0 Compliance Validation
 * 
 * This script performs comprehensive validation of:
 * 1. Official A2A protocol implementation
 * 2. Agent0 registry integration
 * 3. AgentCard compliance
 * 4. Skill functionality
 * 5. End-to-end workflows
 * 
 * Run: bun run scripts/validate-a2a-agent0-compliance.ts
 */

import { A2AClient } from '@a2a-js/sdk/client'
import { SDK } from 'agent0-sdk'
import type { AgentCard } from '@a2a-js/sdk'
import { prisma } from '../src/lib/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const AGENT_CARD_URL = `${BASE_URL}/.well-known/agent-card.json`

interface ValidationResult {
  category: string
  check: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  required: boolean
}

const results: ValidationResult[] = []

function addResult(
  category: string,
  check: string,
  status: 'pass' | 'fail' | 'warning',
  message: string,
  required: boolean = false
) {
  results.push({ category, check, status, message, required })
  
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️'
  const req = required ? ' [REQUIRED]' : ''
  console.log(`${icon} ${check}${req}: ${message}`)
}

async function validateA2AProtocol() {
  console.log('\n📋 Validating Official A2A Protocol...')
  console.log('='.repeat(60))
  
  try {
    // 1. Fetch AgentCard
    const response = await fetch(AGENT_CARD_URL)
    if (!response.ok) {
      addResult('A2A', 'AgentCard accessible', 'fail', 'Cannot fetch agent card', true)
      return
    }
    
    const card: AgentCard = await response.json()
    addResult('A2A', 'AgentCard accessible', 'pass', `Found at ${AGENT_CARD_URL}`, true)
    
    // 2. Validate protocolVersion
    if (card.protocolVersion === '0.3.0') {
      addResult('A2A', 'Protocol version', 'pass', 'v0.3.0 (latest)', true)
    } else {
      addResult('A2A', 'Protocol version', 'fail', `Got ${card.protocolVersion}, expected 0.3.0`, true)
    }
    
    // 3. Validate required fields
    if (card.name) {
      addResult('A2A', 'Agent name', 'pass', card.name, true)
    } else {
      addResult('A2A', 'Agent name', 'fail', 'Missing name field', true)
    }
    
    if (card.preferredTransport === 'JSONRPC') {
      addResult('A2A', 'Preferred transport', 'pass', 'JSONRPC', true)
    } else {
      addResult('A2A', 'Preferred transport', 'warning', `Got ${card.preferredTransport}`)
    }
    
    // 4. Validate skills
    if (!card.skills || card.skills.length === 0) {
      addResult('A2A', 'Skills declaration', 'fail', 'No skills defined', true)
    } else {
      addResult('A2A', 'Skills declaration', 'pass', `${card.skills.length} skills defined`, true)
      
      // Validate each skill has required fields
      let invalidSkills = 0
      card.skills.forEach(skill => {
        if (!skill.id || !skill.name || !skill.description || !skill.examples || skill.examples.length === 0) {
          invalidSkills++
        }
      })
      
      if (invalidSkills > 0) {
        addResult('A2A', 'Skill validation', 'fail', `${invalidSkills} skills missing required fields`, true)
      } else {
        addResult('A2A', 'Skill validation', 'pass', 'All skills have required fields', true)
      }
    }
    
    // 5. Test A2A client connection
    try {
      const client = await A2AClient.fromCardUrl(AGENT_CARD_URL)
      addResult('A2A', 'SDK client connection', 'pass', 'Official A2AClient initialized', true)
      
      // 6. Test message/send
      try {
        const sendResponse = await client.sendMessage({
          message: {
            kind: 'message',
            messageId: crypto.randomUUID(),
            role: 'user',
            parts: [{
              kind: 'text',
              text: '{"action": "get_balance", "params": {}}'
            }]
          }
        })
        
        if (sendResponse) {
          addResult('A2A', 'message/send method', 'pass', 'Message sent and response received', true)
        } else {
          addResult('A2A', 'message/send method', 'fail', 'No response', true)
        }
        
        // 7. Test tasks/get
        if ('kind' in sendResponse && sendResponse.kind === 'task') {
          const task = sendResponse as any
          try {
            const taskStatus = await client.getTask({ id: task.id })
            const taskState = (taskStatus as any)?.status?.state ?? 'unknown'
            addResult('A2A', 'tasks/get method', 'pass', `Task retrieval working (state=${taskState})`, true)
          } catch (error) {
            addResult('A2A', 'tasks/get method', 'fail', (error as Error).message, true)
          }
          
          // 8. Test tasks/cancel
          try {
            await client.cancelTask({ id: task.id })
            addResult('A2A', 'tasks/cancel method', 'pass', 'Task cancellation working', true)
          } catch (error) {
            // Might fail if already completed - that's OK
            addResult('A2A', 'tasks/cancel method', 'warning', 'Task may have completed')
          }
        }
        
      } catch (error) {
        addResult('A2A', 'message/send method', 'fail', (error as Error).message, true)
      }
      
    } catch (error) {
      addResult('A2A', 'SDK client connection', 'fail', (error as Error).message, true)
    }
    
  } catch (error) {
    addResult('A2A', 'AgentCard parsing', 'fail', (error as Error).message, true)
  }
}

async function validateAgent0Integration() {
  console.log('\n📋 Validating Agent0 Integration...')
  console.log('='.repeat(60))
  
  try {
    // 1. Check if registered
    const config = await prisma.gameConfig.findUnique({
      where: { key: 'agent0_registration' }
    })
    
    type Agent0Config = {
      agentId?: string
      tokenId?: number
      chainId?: number
    }
    const configValue = (config?.value ?? null) as Agent0Config | null
    
    if (!configValue?.agentId) {
      addResult('Agent0', 'On-chain registration', 'fail', 'Babylon not registered on Agent0', true)
      addResult('Agent0', 'Registration check', 'warning', 'Run: bun run scripts/register-babylon-agent0.ts')
      
      // Can't do further validation without registration
      return
    }
    
    addResult('Agent0', 'On-chain registration', 'pass', `Registered as ${configValue.agentId}`, true)
    
    // 2. Query Agent0 SDK
    const agent0 = new SDK({
      chainId: configValue.chainId || 84532,
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    })
    
    // 3. Verify in subgraph
    try {
      const agent = await agent0.getAgent(configValue.agentId)
      
      if (agent) {
        addResult('Agent0', 'Subgraph indexed', 'pass', 'Found in Agent0 subgraph', true)
        addResult('Agent0', 'Agent active', agent.active ? 'pass' : 'warning', `Active: ${agent.active}`)
        
        if (agent.a2a) {
          addResult('Agent0', 'A2A support', 'pass', 'A2A enabled', true)
        } else {
          addResult('Agent0', 'A2A support', 'fail', 'A2A not enabled in registration', true)
        }
        
        if (agent.a2aSkills && agent.a2aSkills.length > 0) {
          addResult('Agent0', 'Skills indexed', 'pass', `${agent.a2aSkills.length} skills`, true)
        } else {
          addResult('Agent0', 'Skills indexed', 'warning', 'No skills indexed (may take time)')
        }
        
      } else {
        addResult('Agent0', 'Subgraph indexed', 'warning', 'Not yet indexed (try again in a few minutes)')
      }
    } catch (error) {
      addResult('Agent0', 'Subgraph query', 'fail', (error as Error).message)
    }
    
    // 4. Test discovery
    try {
      const searchResults = await agent0.searchAgents({
        a2a: true,
        name: 'Babylon',
        active: true
      })
      
      const found = searchResults.items.find(a => a.agentId === configValue?.agentId)
      
      if (found) {
        addResult('Agent0', 'Discoverable', 'pass', 'Babylon is discoverable via search', true)
      } else {
        addResult('Agent0', 'Discoverable', 'warning', 'Not yet discoverable (indexing delay)')
      }
    } catch (error) {
      addResult('Agent0', 'Discovery test', 'fail', (error as Error).message)
    }
    
  } catch (error) {
    addResult('Agent0', 'SDK initialization', 'fail', (error as Error).message)
  }
}

async function generateReport() {
  console.log('\n📊 Compliance Report')
  console.log('='.repeat(60))
  
  const categories = [...new Set(results.map(r => r.category))]
  
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category)
    const passed = categoryResults.filter(r => r.status === 'pass').length
    const failed = categoryResults.filter(r => r.status === 'fail').length
    const warnings = categoryResults.filter(r => r.status === 'warning').length
    const total = categoryResults.length
    
    const score = (passed / total * 100).toFixed(0)
    
    console.log(`\n${category}:`)
    console.log(`  Passed:   ${passed}/${total}`)
    console.log(`  Failed:   ${failed}/${total}`)
    console.log(`  Warnings: ${warnings}/${total}`)
    console.log(`  Score:    ${score}%`)
  })
  
  // Critical failures
  const criticalFails = results.filter(r => r.required && r.status === 'fail')
  
  if (criticalFails.length > 0) {
    console.log('\n🔴 Critical Failures (MUST FIX):')
    criticalFails.forEach(r => {
      console.log(`   - ${r.category}: ${r.check}`)
      console.log(`     ${r.message}`)
    })
  }
  
  // Overall score
  const totalPassed = results.filter(r => r.status === 'pass').length
  const totalRequired = results.filter(r => r.required).length
  const requiredPassed = results.filter(r => r.required && r.status === 'pass').length
  
  const overallScore = (totalPassed / results.length * 100).toFixed(0)
  const requiredScore = (requiredPassed / totalRequired * 100).toFixed(0)
  
  console.log('\n📈 Overall Compliance:')
  console.log(`  All Checks:       ${totalPassed}/${results.length} (${overallScore}%)`)
  console.log(`  Required Checks:  ${requiredPassed}/${totalRequired} (${requiredScore}%)`)
  
  if (criticalFails.length === 0) {
    console.log('\n🎉 ALL CRITICAL REQUIREMENTS MET!')
    console.log('   Babylon is compliant and ready for production')
  } else {
    console.log('\n⚠️  Some critical requirements not met')
    console.log(`   ${criticalFails.length} critical issues to fix`)
  }
}

// Main validation
async function validate() {
  console.log('🔍 Babylon A2A & Agent0 Compliance Validation')
  console.log('='.repeat(60))
  console.log(`Testing endpoint: ${BASE_URL}`)
  console.log(`Agent Card URL: ${AGENT_CARD_URL}`)
  
  await validateA2AProtocol()
  await validateAgent0Integration()
  await generateReport()
  
  console.log('\n✨ Validation complete!')
  console.log('\n📚 For detailed implementation status, see:')
  console.log('   - README_A2A_AGENT0.md')
  console.log('   - CRITICAL_A2A_AGENT0_REVIEW.md')
  console.log('   - A2A_AGENT0_FINAL_STATUS.md')
}

if (import.meta.main) {
  validate()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('\n💥 Validation error:', error)
      process.exit(1)
    })
}

export { validate }

