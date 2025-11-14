/**
 * PostHog Integration Test Script
 * 
 * Run this script to verify PostHog is configured correctly:
 * bun run scripts/test-posthog-integration.ts
 */

import { getPostHogServerClient, trackServerEvent, flushPostHog } from '../src/lib/posthog/server'

async function testPostHogIntegration() {
  console.log('🧪 Testing PostHog Integration...\n')

  // Check environment variables
  console.log('1. Checking environment variables...')
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!apiKey) {
    console.error('❌ NEXT_PUBLIC_POSTHOG_KEY is not set')
    console.log('\nPlease add to your .env.local:')
    console.log('NEXT_PUBLIC_POSTHOG_KEY="your_posthog_project_api_key"')
    console.log('NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"')
    process.exit(1)
  }

  console.log('✅ Environment variables configured')
  console.log(`   API Host: ${apiHost}`)
  console.log(`   API Key: ${apiKey.substring(0, 10)}...`)

  // Initialize PostHog client
  console.log('\n2. Initializing PostHog server client...')
  const client = getPostHogServerClient()

  if (!client) {
    console.error('❌ Failed to initialize PostHog client')
    process.exit(1)
  }

  console.log('✅ PostHog server client initialized')

  // Send test event
  console.log('\n3. Sending test event...')
  try {
    await trackServerEvent('test-user-' + Date.now(), 'posthog_test_event', {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'This is a test event from the integration test script',
    })

    // Flush to ensure event is sent
    await flushPostHog()

    console.log('✅ Test event sent successfully')
    console.log('\n📊 Check your PostHog dashboard (Live Events) to see the event')
    console.log('   Event name: posthog_test_event')
    console.log('   It may take a few seconds to appear')
  } catch (error) {
    console.error('❌ Failed to send test event:', error)
    process.exit(1)
  }

  console.log('\n✅ PostHog integration test passed!')
  console.log('\n📚 Next steps:')
  console.log('1. Start your dev server: bun run dev')
  console.log('2. Open the app in your browser')
  console.log('3. Check browser console for: "PostHog initialized successfully"')
  console.log('4. Navigate around the app and check PostHog dashboard for events')
  console.log('\n📖 Full documentation: /docs/POSTHOG_INTEGRATION.md')
}

testPostHogIntegration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error)
    process.exit(1)
  })

