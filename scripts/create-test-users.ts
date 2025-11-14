/**
 * Create test users for DM testing
 */

import { prisma } from '@/lib/database-service'

async function createTestUsers() {
  console.log('🧪 Creating Test Users for DM Testing\n')

  try {
    // Check if test users already exist
    const existingTestUsers = await prisma.user.findMany({
      where: {
        username: {
          in: ['testuser1', 'testuser2']
        }
      }
    })

    if (existingTestUsers.length > 0) {
      console.log('⚠️  Test users already exist:')
      existingTestUsers.forEach(u => {
        console.log(`   - ${u.displayName} (@${u.username}) - ${u.id}`)
      })
      console.log('\n✅ You can use these users for testing DMs')
      return
    }

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        privyId: `did:privy:test-user-1-${Date.now()}`,
        username: 'testuser1',
        displayName: 'Test User 1',
        bio: 'Test account for DM testing',
        isActor: false,
        profileComplete: true,
        hasUsername: true,
      }
    })

    const user2 = await prisma.user.create({
      data: {
        privyId: `did:privy:test-user-2-${Date.now()}`,
        username: 'testuser2',
        displayName: 'Test User 2',
        bio: 'Test account for DM testing',
        isActor: false,
        profileComplete: true,
        hasUsername: true,
      }
    })

    console.log('✅ Created test users:')
    console.log(`   User 1: ${user1.displayName} (@${user1.username})`)
    console.log(`   ID: ${user1.id}`)
    console.log(`\n   User 2: ${user2.displayName} (@${user2.username})`)
    console.log(`   ID: ${user2.id}`)

    // Generate DM chat ID
    const sortedIds = [user1.id, user2.id].sort()
    const dmChatId = `dm-${sortedIds.join('-')}`
    
    console.log(`\n📝 DM Chat ID: ${dmChatId}`)
    console.log(`\n💡 To test DMs:`)
    console.log(`   1. Login as one of these users`)
    console.log(`   2. Go to /profile/${user2.username}`)
    console.log(`   3. Click "Message" button`)
    console.log(`   4. Send a message`)
    console.log(`   5. Open incognito, login as other user`)
    console.log(`   6. Verify message appears in real-time`)

  } catch (error) {
    console.error('\n❌ Error creating test users:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createTestUsers().catch(console.error)

