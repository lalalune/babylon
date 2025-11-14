import { defineConfig, devices } from '@playwright/test'
// Wallet setup will be configured when MetaMask integration is needed
// import { defineWalletSetup } from '@synthetixio/synpress'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '.env.local') })
// Fallback to .env if .env.local doesn't exist
config({ path: resolve(__dirname, '.env') })

const SEED_PHRASE = process.env.WALLET_SEED_PHRASE || 'test test test test test test test test test test test junk'
const PASSWORD = process.env.WALLET_PASSWORD || 'Tester@1234'

// Verify Privy test credentials are loaded (for debugging)
if (process.env.PRIVY_TEST_EMAIL) {
  console.log('✅ Privy test credentials loaded successfully')
} else {
  console.warn('⚠️ Privy test credentials not found in environment')
}

export default defineConfig({
  testDir: './tests/synpress',
  testMatch: '**/*.spec.ts',
  
  /* Maximum time one test can run for */
  timeout: process.env.CI ? 60 * 1000 : 120 * 1000,
  
  /* Run tests in files in parallel */
  fullyParallel: false,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  
  /* Use 2 workers in CI for faster execution, 1 locally for stability */
  workers: process.env.CI ? 2 : 1,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'], // Non-blocking console output only
    ['json', { outputFile: 'test-results/synpress-results.json' }],
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'retain-on-failure',
    
    /* Action timeout - reduced in CI for faster feedback */
    actionTimeout: process.env.CI ? 15 * 1000 : 30 * 1000,
    
    /* Navigation timeout - reduced in CI */
    navigationTimeout: process.env.CI ? 30 * 1000 : 60 * 1000,
  },

  /* Configure projects for major browsers with wallet setup */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Wallet setup commented out - Privy uses embedded wallets, not MetaMask extension
        // ...defineWalletSetup(SEED_PHRASE, PASSWORD),
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  // NOTE: Start your dev server manually with 'bun run dev' before running tests
  // webServer config disabled to avoid conflicts with manually-run server
})

