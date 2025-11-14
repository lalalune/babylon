#!/usr/bin/env bun
/**
 * Verification script for Agents E2E Tests
 * Checks that all test files are properly configured and can be loaded
 */

import { existsSync } from 'fs'
import { resolve } from 'path'

const testFiles = [
  'tests/e2e/agents-flow.spec.ts',
  'tests/e2e/agents-a2a-integration.spec.ts',
  'tests/synpress/15-agents.spec.ts',
  'tests/synpress/agent-babylon-integration.spec.ts',
  'tests/synpress/helpers/test-data.ts',
]

const configFiles = [
  'playwright.config.ts',
  'synpress.config.ts',
]

const apiFiles = [
  'src/app/api/agents/generate-field/route.ts',
  'src/app/api/agents/route.ts',
  'src/app/agents/page.tsx',
  'src/app/agents/create/page.tsx',
]

console.log('🔍 Verifying Agents E2E Test Configuration...\n')

let allGood = true

// Check test files
console.log('📝 Test Files:')
for (const file of testFiles) {
  const path = resolve(process.cwd(), file)
  const exists = existsSync(path)
  console.log(`  ${exists ? '✅' : '❌'} ${file}`)
  if (!exists) allGood = false
}

// Check config files
console.log('\n⚙️  Configuration Files:')
for (const file of configFiles) {
  const path = resolve(process.cwd(), file)
  const exists = existsSync(path)
  console.log(`  ${exists ? '✅' : '❌'} ${file}`)
  if (!exists) allGood = false
}

// Check API files
console.log('\n🔧 API & Page Files:')
for (const file of apiFiles) {
  const path = resolve(process.cwd(), file)
  const exists = existsSync(path)
  console.log(`  ${exists ? '✅' : '❌'} ${file}`)
  if (!exists) allGood = false
}

// Check environment variables
console.log('\n🔐 Environment Variables:')
const envVars = [
  'ANTHROPIC_API_KEY',
  'PRIVY_TEST_EMAIL',
  'PRIVY_TEST_PASSWORD',
]

for (const envVar of envVars) {
  const exists = !!process.env[envVar]
  console.log(`  ${exists ? '✅' : '⚠️ '} ${envVar} ${exists ? 'set' : 'not set (optional for some tests)'}`)
}

// Check test results directory
console.log('\n📁 Test Results Directory:')
const testResultsDir = resolve(process.cwd(), 'test-results')
const screenshotsDir = resolve(process.cwd(), 'test-results/screenshots')

if (!existsSync(testResultsDir)) {
  console.log('  ⚠️  test-results/ directory not found (will be created on first run)')
} else {
  console.log('  ✅ test-results/ directory exists')
}

if (!existsSync(screenshotsDir)) {
  console.log('  ⚠️  test-results/screenshots/ directory not found (will be created on first run)')
} else {
  console.log('  ✅ test-results/screenshots/ directory exists')
}

// Summary
console.log('\n' + '='.repeat(60))
if (allGood) {
  console.log('✅ All required files are present!')
  console.log('\n📚 Documentation: tests/AGENTS_TESTS_SUMMARY.md')
  console.log('\n🚀 To run tests:')
  console.log('  E2E:      bun run playwright test tests/e2e/agents-flow.spec.ts')
  console.log('  Synpress: bun run playwright test tests/synpress/15-agents.spec.ts --config=synpress.config.ts')
  console.log('\n💡 Tip: Run with --ui flag for interactive debugging')
  process.exit(0)
} else {
  console.log('❌ Some files are missing!')
  console.log('\n🔧 Please check the files marked with ❌ above')
  process.exit(1)
}

