/**
 * Migration Script: Update Points System
 * 
 * This script migrates existing users to the new points system:
 * - Syncs earned points from lifetime P&L
 * - Recalculates total reputation points
 * - Updates invite points from existing referral counts
 */

import { prisma } from '../src/lib/database-service'
import { EarnedPointsService } from '../src/lib/services/earned-points-service'
import { logger } from '../src/lib/logger'

async function migratePointsSystem() {
  console.log('🔄 Starting points system migration...\n')

  try {
    // Get all non-actor users
    const users = await prisma.user.findMany({
      where: { isActor: false },
      select: {
        id: true,
        username: true,
        lifetimePnL: true,
        referralCount: true,
        reputationPoints: true,
        invitePoints: true,
        earnedPoints: true,
        bonusPoints: true,
        pointsAwardedForEmail: true,
        pointsAwardedForWallet: true,
        pointsAwardedForProfile: true,
      },
    })

    console.log(`📊 Found ${users.length} users to migrate\n`)

    let successCount = 0
    let errorCount = 0

    for (const user of users) {
      try {
        // Calculate earned points from P&L
        const lifetimePnL = Number(user.lifetimePnL)
        const earnedPoints = EarnedPointsService.pnlToPoints(lifetimePnL)

        // Calculate invite points from referral count (50 points per referral)
        const invitePoints = user.referralCount * 50

        // Calculate bonus points from existing tracking flags
        let bonusPoints = 0
        if (user.pointsAwardedForEmail) bonusPoints += 25
        if (user.pointsAwardedForWallet) bonusPoints += 25
        if (user.pointsAwardedForProfile) bonusPoints += 50 // Profile completion bonus

        // Calculate new total reputation points
        // Base (100) + Invite + Earned + Bonus
        const basePoints = 100
        const newReputationPoints = basePoints + invitePoints + earnedPoints + bonusPoints

        // Update user
        await prisma.user.update({
          where: { id: user.id },
          data: {
            earnedPoints,
            invitePoints,
            bonusPoints,
            reputationPoints: newReputationPoints,
          },
        })

        successCount++
        
        console.log(`✅ ${user.username || user.id}:`)
        console.log(`   P&L: $${lifetimePnL.toFixed(2)} → Earned: ${earnedPoints} points`)
        console.log(`   Referrals: ${user.referralCount} → Invite: ${invitePoints} points`)
        console.log(`   Bonus: ${bonusPoints} points`)
        console.log(`   Old Total: ${user.reputationPoints} → New Total: ${newReputationPoints}`)
        console.log()
      } catch (error) {
        errorCount++
        console.error(`❌ Error migrating user ${user.id}:`, error)
      }
    }

    console.log('\n📈 Migration Summary:')
    console.log(`   Total users: ${users.length}`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log()

    // Show leaderboard preview
    console.log('🏆 Top 10 Leaderboard After Migration:\n')
    const topUsers = await prisma.user.findMany({
      where: { isActor: false },
      orderBy: { reputationPoints: 'desc' },
      take: 10,
      select: {
        username: true,
        reputationPoints: true,
        invitePoints: true,
        earnedPoints: true,
        bonusPoints: true,
      },
    })

    topUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username || 'Anonymous'}`)
      console.log(`   All: ${user.reputationPoints} | Invite: ${user.invitePoints} | Earned: ${user.earnedPoints} | Bonus: ${user.bonusPoints}`)
    })

    console.log('\n✨ Migration complete!')
  } catch (error) {
    console.error('💥 Migration failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
migratePointsSystem()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

