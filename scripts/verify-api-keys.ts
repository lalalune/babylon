/**
 * Verify API Keys Script
 * 
 * Checks if OpenAI/Groq API keys are properly configured and working
 */

import OpenAI from 'openai'

async function verifyKeys() {
  console.log('🔑 Verifying API Keys...\n')
  
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  const hasGroq = !!process.env.GROQ_API_KEY
  
  console.log('Environment Variables:')
  console.log(`  OPENAI_API_KEY: ${hasOpenAI ? '✅ Set' : '❌ Not set'}`)
  console.log(`  GROQ_API_KEY: ${hasGroq ? '✅ Set' : '❌ Not set'}`)
  
  if (!hasOpenAI && !hasGroq) {
    console.log('\n❌ ERROR: No API keys found!')
    console.log('\nPlease set one of the following in .env.local:')
    console.log('  OPENAI_API_KEY=sk-...')
    console.log('  GROQ_API_KEY=gsk_...')
    process.exit(1)
  }
  
  console.log('\n🧪 Testing API Connection...\n')
  
  // Try Groq first (it's working), fallback to OpenAI
  const useGroq = hasGroq
  const openai = new OpenAI({
    apiKey: useGroq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY,
    baseURL: useGroq
      ? 'https://api.groq.com/openai/v1'
      : 'https://api.openai.com/v1',
  })
  
  try {
    const response = await openai.chat.completions.create({
      model: useGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Say "API key working!" in exactly 3 words.',
        },
      ],
      max_tokens: 10,
    })
    
    const result = response.choices[0]?.message?.content
    
    console.log(`✅ API Test Successful!`)
    console.log(`   Provider: ${useGroq ? 'Groq' : 'OpenAI'}`)
    console.log(`   Model: ${useGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'}`)
    console.log(`   Response: "${result}"`)
    console.log('\n🎉 API keys are working correctly!')
    
    if (hasOpenAI && hasGroq) {
      console.log(`\n💡 Note: Using Groq (faster). OpenAI key also available as fallback.`)
    }
    console.log('\n✅ Ready to use:')
    console.log('   - Tag generation (generateTagsFromPost)')
    console.log('   - Trending summaries (generateTrendingSummary)')
    
  } catch (error) {
    console.log('❌ API Test Failed!')
    console.error('\nError:', error)
    console.log('\nPlease check:')
    console.log('  1. API key is valid and not expired')
    console.log('  2. API key has sufficient credits')
    console.log('  3. Network connection is working')
    process.exit(1)
  }
}

verifyKeys()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
