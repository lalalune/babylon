/**
 * Script to generate example P&L share cards
 * Run with: npx tsx scripts/generate-pnl-cards.ts
 */

import * as fs from 'fs/promises'
import * as path from 'path'

// Mock data for generating example cards
const exampleUsers = [
  {
    id: 'user-1',
    displayName: 'Alex Trader',
    username: 'alextrader',
    handle: 'alextrader',
    profileImageUrl: null,
  },
  {
    id: 'user-2',
    displayName: 'Sarah DeFi',
    username: 'sarahdefi',
    handle: 'sarahdefi',
    profileImageUrl: null,
  },
  {
    id: 'user-3',
    displayName: 'Mike Markets',
    username: 'mikemarkets',
    handle: 'mikemarkets',
    profileImageUrl: null,
  },
]

const examplePnLData = {
  // Portfolio-level examples
  portfolio: [
    {
      lifetimePnL: 2500,
      netContributions: 10000,
      totalDeposited: 10000,
      totalWithdrawn: 0,
      availableBalance: 5000,
      unrealizedPerpPnL: 1200,
      unrealizedPredictionPnL: 800,
      unrealizedPoolPnL: 500,
      totalUnrealizedPnL: 2500,
      totalPnL: 2500,
      accountEquity: 12500,
    },
    {
      lifetimePnL: -500,
      netContributions: 5000,
      totalDeposited: 5000,
      totalWithdrawn: 0,
      availableBalance: 2000,
      unrealizedPerpPnL: -300,
      unrealizedPredictionPnL: -150,
      unrealizedPoolPnL: -50,
      totalUnrealizedPnL: -500,
      totalPnL: -500,
      accountEquity: 4500,
    },
  ],
  
  // Category-specific examples
  perps: [
    {
      unrealizedPnL: 1200,
      positionCount: 5,
      totalValue: 8000,
      categorySpecific: { openInterest: 8000 },
    },
    {
      unrealizedPnL: -300,
      positionCount: 3,
      totalValue: 4000,
      categorySpecific: { openInterest: 4000 },
    },
  ],
  
  predictions: [
    {
      unrealizedPnL: 800,
      positionCount: 8,
      totalValue: 3500,
      categorySpecific: { totalShares: 1250.5 },
    },
    {
      unrealizedPnL: -150,
      positionCount: 4,
      totalValue: 1800,
      categorySpecific: { totalShares: 520.25 },
    },
  ],
  
  pools: [
    {
      unrealizedPnL: 500,
      positionCount: 2,
      totalValue: 3500,
      categorySpecific: { totalInvested: 3000 },
    },
    {
      unrealizedPnL: -50,
      positionCount: 1,
      totalValue: 950,
      categorySpecific: { totalInvested: 1000 },
    },
  ],
}

async function generateExampleCards() {
  const outputDir = path.join(process.cwd(), 'public', 'examples', 'pnl-cards')
  
  try {
    await fs.mkdir(outputDir, { recursive: true })
    console.log(`✅ Created output directory: ${outputDir}`)
  } catch (err) {
    console.error('Error creating output directory:', err)
  }

  // Generate example metadata files
  const examples: any[] = []
  
  // Portfolio examples
  exampleUsers.slice(0, 2).forEach((user, idx) => {
    const data = examplePnLData.portfolio[idx]
    examples.push({
      type: 'portfolio',
      user,
      data,
      filename: `portfolio-${idx + 1}.png`,
      description: data.totalPnL >= 0 ? 'Profitable portfolio example' : 'Loss portfolio example',
    })
  })
  
  // Perps examples
  exampleUsers.slice(0, 2).forEach((user, idx) => {
    const data = examplePnLData.perps[idx]
    examples.push({
      type: 'perps',
      user,
      data,
      filename: `perps-${idx + 1}.png`,
      description: data.unrealizedPnL >= 0 ? 'Profitable perps example' : 'Loss perps example',
    })
  })
  
  // Predictions examples
  exampleUsers.slice(0, 2).forEach((user, idx) => {
    const data = examplePnLData.predictions[idx]
    examples.push({
      type: 'predictions',
      user,
      data,
      filename: `predictions-${idx + 1}.png`,
      description: data.unrealizedPnL >= 0 ? 'Profitable predictions example' : 'Loss predictions example',
    })
  })
  
  // Pools examples
  exampleUsers.slice(0, 2).forEach((user, idx) => {
    const data = examplePnLData.pools[idx]
    examples.push({
      type: 'pools',
      user,
      data,
      filename: `pools-${idx + 1}.png`,
      description: data.unrealizedPnL >= 0 ? 'Profitable pools example' : 'Loss pools example',
    })
  })
  
  // Save metadata
  const metadataPath = path.join(outputDir, 'metadata.json')
  await fs.writeFile(metadataPath, JSON.stringify(examples, null, 2))
  console.log(`✅ Saved metadata to: ${metadataPath}`)
  
  // Save README
  const readme = `# Example P&L Share Cards

This directory contains example P&L share cards generated for review.

## Files

${examples.map(ex => `- **${ex.filename}**: ${ex.description}`).join('\n')}

## Generation Instructions

To generate these cards:

1. Navigate to the markets page: http://localhost:3000/markets
2. Click on each tab (Dashboard, Perps, Predictions, Pools)
3. If you have positions, click the "Share" button on the P&L card
4. In the modal, click "Download P&L Card"
5. The card will be saved as a PNG image

## Card Specifications

- **Dimensions**: 1200x630 pixels
- **Format**: PNG with 2x pixel ratio
- **Optimized for**: Twitter/X, Farcaster, other social media
- **Brand Colors**: #0066FF (Babylon Blue), category-specific gradients

## Features

- User profile image and username
- Timestamp
- Large P&L display with color coding (green for profit, red for loss)
- Category-specific metrics
- Babylon logo branding
- Professional gradient background
- "Trade the narrative. Share the upside." tagline

## Testing

To test the sharing functionality:

1. Start the development server: \`npm run dev\`
2. Navigate to: http://localhost:3000/markets
3. Make some test trades or deposits
4. Click "Share" on any P&L card
5. Try all share options:
   - Share to X (Twitter)
   - Share to Farcaster
   - Download card
   - Copy link

## Notes

- The share cards use the actual Babylon logo SVG
- Colors match the brand guidelines (#0066FF primary)
- Cards are generated client-side using html-to-image library
- No API keys required for basic sharing (uses intent URLs)
`

  const readmePath = path.join(outputDir, 'README.md')
  await fs.writeFile(readmePath, readme)
  console.log(`✅ Saved README to: ${readmePath}`)
  
  console.log(`
🎨 Example P&L Cards Generation Complete!

📂 Output Directory: ${outputDir}
📄 Files Created:
   - metadata.json (example data)
   - README.md (instructions)

🚀 Next Steps:
   1. Start the dev server: npm run dev
   2. Navigate to: http://localhost:3000/markets
   3. Make some test trades to generate real P&L data
   4. Click "Share" buttons to test the functionality
   5. Use "Download P&L Card" to save example images

💡 The actual PNG images will be generated when you use the 
   Download feature in the share modal. The cards are rendered
   client-side using html-to-image library.
  `)
  
  return examples
}

// Run the script
generateExampleCards()
  .then(() => {
    console.log('\n✅ Script completed successfully!')
  })
  .catch((err) => {
    console.error('\n❌ Error running script:', err)
    process.exit(1)
  })

