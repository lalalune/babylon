#!/usr/bin/env bun
/**
 * Dev Server Wrapper
 * 
 * Wraps the dev server startup to ensure proper cleanup of port 3000
 * when the process exits (via Ctrl+C or other signals).
 */

import { killPort } from './utils/kill-port'
import { spawn, type ChildProcess } from 'child_process'

const PORT = 3000

// Track if we've already cleaned up
let cleanedUp = false

async function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  
  console.log('\n🛑 Cleaning up dev server...')
  
  // Kill any processes on port 3000
  const killed = await killPort(PORT, process.pid)
  if (killed > 0) {
    console.log(`✅ Cleaned up ${killed} process(es) on port ${PORT}`)
  }
}

// Handle various exit signals
process.on('SIGINT', async () => {
  await cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await cleanup()
  process.exit(0)
})

process.on('exit', () => {
  // Synchronous cleanup only in exit handler
  void cleanup()
})

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error)
  await cleanup()
  process.exit(1)
})

// Handle unhandled rejections
process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled rejection:', reason)
  await cleanup()
  process.exit(1)
})

// Get the command to run (everything after this script name)
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('Usage: bun run scripts/dev-wrapper.ts <command> [args...]')
  process.exit(1)
}

// Spawn the actual command
const command = args[0]
if (!command) {
  console.error('Error: No command provided')
  process.exit(1)
}

const child: ChildProcess = spawn(command, args.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

// Forward exit code
child.on('exit', async (code: number | null) => {
  await cleanup()
  process.exit(code ?? 0)
})

// Handle child process errors
child.on('error', async (error: Error) => {
  console.error('Child process error:', error)
  await cleanup()
  process.exit(1)
})

