/**
 * Admin User Management Script
 * 
 * Usage:
 *   bun run scripts/manage-admin.ts grant <wallet-address-or-username>
 *   bun run scripts/manage-admin.ts revoke <wallet-address-or-username>
 *   bun run scripts/manage-admin.ts list
 */

import { prisma } from '../src/lib/database-service'

const command = process.argv[2]
const identifier = process.argv[3]

async function grantAdmin(identifier: string) {
  // Find user by wallet address or username
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { walletAddress: identifier },
        { username: identifier },
        { id: identifier },
      ],
    },
  })

  if (!user) {
    console.error(`❌ User not found: ${identifier}`)
    process.exit(1)
  }

  if (user.isAdmin) {
    console.log(`ℹ️  User ${user.username || user.walletAddress || user.id} is already an admin`)
    process.exit(0)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: true },
  })

  console.log(`✅ Admin privileges granted to ${user.username || user.walletAddress || user.id}`)
  console.log(`   User ID: ${user.id}`)
  console.log(`   Display Name: ${user.displayName || 'N/A'}`)
}

async function revokeAdmin(identifier: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { walletAddress: identifier },
        { username: identifier },
        { id: identifier },
      ],
    },
  })

  if (!user) {
    console.error(`❌ User not found: ${identifier}`)
    process.exit(1)
  }

  if (!user.isAdmin) {
    console.log(`ℹ️  User ${user.username || user.walletAddress || user.id} is not an admin`)
    process.exit(0)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: false },
  })

  console.log(`✅ Admin privileges revoked from ${user.username || user.walletAddress || user.id}`)
}

async function listAdmins() {
  const admins = await prisma.user.findMany({
    where: { isAdmin: true },
    select: {
      id: true,
      username: true,
      displayName: true,
      walletAddress: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (admins.length === 0) {
    console.log('ℹ️  No admin users found')
    process.exit(0)
  }

  console.log(`\n📋 Admin Users (${admins.length}):\n`)
  console.log('─'.repeat(80))
  
  for (const admin of admins) {
    console.log(`\nUsername:     ${admin.username || 'N/A'}`)
    console.log(`Display Name: ${admin.displayName || 'N/A'}`)
    console.log(`Wallet:       ${admin.walletAddress || 'N/A'}`)
    console.log(`User ID:      ${admin.id}`)
    console.log(`Joined:       ${admin.createdAt.toISOString()}`)
    console.log('─'.repeat(80))
  }
}

async function main() {
  try {
    switch (command) {
      case 'grant':
        if (!identifier) {
          console.error('❌ Please provide a wallet address, username, or user ID')
          console.log('\nUsage: bun run scripts/manage-admin.ts grant <identifier>')
          process.exit(1)
        }
        await grantAdmin(identifier)
        break

      case 'revoke':
        if (!identifier) {
          console.error('❌ Please provide a wallet address, username, or user ID')
          console.log('\nUsage: bun run scripts/manage-admin.ts revoke <identifier>')
          process.exit(1)
        }
        await revokeAdmin(identifier)
        break

      case 'list':
        await listAdmins()
        break

      default:
        console.log('Babylon Admin Management Tool')
        console.log('\nUsage:')
        console.log('  bun run scripts/manage-admin.ts grant <wallet-address-or-username>')
        console.log('  bun run scripts/manage-admin.ts revoke <wallet-address-or-username>')
        console.log('  bun run scripts/manage-admin.ts list')
        console.log('\nExamples:')
        console.log('  bun run scripts/manage-admin.ts grant alice')
        console.log('  bun run scripts/manage-admin.ts grant 0x1234...5678')
        console.log('  bun run scripts/manage-admin.ts list')
        process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

