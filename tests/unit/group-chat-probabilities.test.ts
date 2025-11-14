/**
 * Group Chat Probability Tests
 * Verifies the math for user retention and NPC dynamics
 */

import { describe, test, expect } from 'bun:test';

describe('Group Chat Probabilities - Mathematical Verification', () => {
  // Constants from the implementation
  const TICKS_PER_HOUR = 60;
  const TICKS_PER_DAY = 1440;
  
  const BASE_KICK_PROBABILITY = 0.00007;
  const NPC_JOIN_PROBABILITY = 0.0007;
  const NPC_LEAVE_PROBABILITY = 0.0007;
  const POST_MESSAGE_PROBABILITY = 0.01;
  const INVITE_USER_PROBABILITY = 0.002;

  describe('User Retention Calculations', () => {
    test('base kick probability gives ~10 day retention', () => {
      const expectedTicks = 1 / BASE_KICK_PROBABILITY;
      const expectedDays = expectedTicks / TICKS_PER_DAY;

      expect(expectedDays).toBeCloseTo(9.92, 1); // ~10 days with base prob
      expect(expectedDays).toBeGreaterThan(9);
      expect(expectedDays).toBeLessThan(11);
    });

    test('never posted multiplier (100×) gives ~3 hour kick time', () => {
      const neverPostedProb = BASE_KICK_PROBABILITY * 100;
      const expectedTicks = 1 / neverPostedProb;
      const expectedHours = expectedTicks / TICKS_PER_HOUR;

      expect(expectedHours).toBeCloseTo(2.4, 1); // ~2.4 hours
      expect(expectedHours).toBeLessThan(5); // Kicked within 5 hours
    });

    test('spam multiplier (20×) gives ~12 hour kick time', () => {
      const spamProb = BASE_KICK_PROBABILITY * 20;
      const expectedTicks = 1 / spamProb;
      const expectedHours = expectedTicks / TICKS_PER_HOUR;

      expect(expectedHours).toBeCloseTo(11.9, 1); // ~12 hours
      expect(expectedHours).toBeGreaterThan(10);
      expect(expectedHours).toBeLessThan(15);
    });

    test('low participation multiplier (3×) gives ~3 day retention', () => {
      const lowParticipationProb = BASE_KICK_PROBABILITY * 3;
      const expectedTicks = 1 / lowParticipationProb;
      const expectedDays = expectedTicks / TICKS_PER_DAY;

      expect(expectedDays).toBeCloseTo(3.31, 1); // ~3.3 days
      expect(expectedDays).toBeGreaterThan(3);
      expect(expectedDays).toBeLessThan(4);
    });

    test('good user (1× multiplier) stays ~10 days', () => {
      const goodUserProb = BASE_KICK_PROBABILITY * 1;
      const expectedTicks = 1 / goodUserProb;
      const expectedDays = expectedTicks / TICKS_PER_DAY;

      expect(expectedDays).toBeCloseTo(9.92, 0.5);
      expect(expectedDays).toBeGreaterThan(9);
      expect(expectedDays).toBeLessThan(11);
    });
  });

  describe('NPC Dynamics Calculations', () => {
    test('NPC join probability gives ~1 join per day', () => {
      const joinsPerDay = NPC_JOIN_PROBABILITY * TICKS_PER_DAY;

      expect(joinsPerDay).toBeCloseTo(1.0, 1);
      expect(joinsPerDay).toBeGreaterThan(0.9);
      expect(joinsPerDay).toBeLessThan(1.1);
    });

    test('NPC leave probability gives ~1 leave per day', () => {
      const leavesPerDay = NPC_LEAVE_PROBABILITY * TICKS_PER_DAY;

      expect(leavesPerDay).toBeCloseTo(1.0, 1);
      expect(leavesPerDay).toBeGreaterThan(0.9);
      expect(leavesPerDay).toBeLessThan(1.1);
    });

    test('with 64 NPCs, expect ~64 joins per day total', () => {
      const npcs = 64;
      const joinsPerNpcPerDay = NPC_JOIN_PROBABILITY * TICKS_PER_DAY;
      const totalJoinsPerDay = npcs * joinsPerNpcPerDay;

      expect(totalJoinsPerDay).toBeCloseTo(64.5, 1);
      expect(totalJoinsPerDay).toBeGreaterThan(60);
      expect(totalJoinsPerDay).toBeLessThan(70);
    });

    test('with 64 NPCs, expect ~64 leaves per day total', () => {
      const npcs = 64;
      const leavesPerNpcPerDay = NPC_LEAVE_PROBABILITY * TICKS_PER_DAY;
      const totalLeavesPerDay = npcs * leavesPerNpcPerDay;

      expect(totalLeavesPerDay).toBeCloseTo(64.5, 1);
      expect(totalLeavesPerDay).toBeGreaterThan(60);
      expect(totalLeavesPerDay).toBeLessThan(70);
    });

    test('NPC churn is balanced (joins ≈ leaves)', () => {
      const joins = NPC_JOIN_PROBABILITY * TICKS_PER_DAY;
      const leaves = NPC_LEAVE_PROBABILITY * TICKS_PER_DAY;

      expect(joins).toEqual(leaves); // Should be exactly equal
    });
  });

  describe('Group Posting Frequency', () => {
    test('group posts ~14 times per day', () => {
      const postsPerDay = POST_MESSAGE_PROBABILITY * TICKS_PER_DAY;

      expect(postsPerDay).toBeCloseTo(14.4, 1);
      expect(postsPerDay).toBeGreaterThan(10);
      expect(postsPerDay).toBeLessThan(20);
    });

    test('with 20 groups, NPC sees ~288 posts per day total', () => {
      const groupsPerNpc = 20;
      const postsPerGroup = POST_MESSAGE_PROBABILITY * TICKS_PER_DAY;
      const totalPostsPerDay = groupsPerNpc * postsPerGroup;

      expect(totalPostsPerDay).toBeCloseTo(288, 10);
      expect(totalPostsPerDay).toBeGreaterThan(250);
      expect(totalPostsPerDay).toBeLessThan(350);
    });

    test('posting frequency is reasonable (not spam)', () => {
      const postsPerHour = POST_MESSAGE_PROBABILITY * TICKS_PER_HOUR;

      expect(postsPerHour).toBeCloseTo(0.6, 1); // ~1 post per hour
      expect(postsPerHour).toBeLessThan(2); // Not more than 2/hour
    });
  });

  describe('User Invite Frequency', () => {
    test('group invites ~3 users per day', () => {
      const invitesPerDay = INVITE_USER_PROBABILITY * TICKS_PER_DAY;

      expect(invitesPerDay).toBeCloseTo(2.88, 1);
      expect(invitesPerDay).toBeGreaterThan(2);
      expect(invitesPerDay).toBeLessThan(4);
    });

    test('with 100 groups, expect ~300 user invites per day total', () => {
      const totalGroups = 100;
      const invitesPerGroup = INVITE_USER_PROBABILITY * TICKS_PER_DAY;
      const totalInvites = totalGroups * invitesPerGroup;

      expect(totalInvites).toBeCloseTo(288, 20);
      expect(totalInvites).toBeGreaterThan(250);
      expect(totalInvites).toBeLessThan(350);
    });
  });

  describe('Realistic Scenarios', () => {
    test('user who posts once per day stays ~10 days', () => {
      // 1 post per day = good participation
      // Multiplier: 1×
      // Kick prob: 0.00007
      
      const kickProb = BASE_KICK_PROBABILITY * 1;
      const expectedDays = (1 / kickProb) / TICKS_PER_DAY;

      expect(expectedDays).toBeCloseTo(9.92, 0.5);
      expect(expectedDays).toBeGreaterThan(9);
      expect(expectedDays).toBeLessThan(11);
    });

    test('user who never posts is kicked in hours, not days', () => {
      const kickProb = BASE_KICK_PROBABILITY * 100;
      const expectedHours = (1 / kickProb) / TICKS_PER_HOUR;

      expect(expectedHours).toBeLessThan(5);
      expect(expectedHours).toBeGreaterThan(1);
    });

    test('NPC in 20 groups sees manageable post volume', () => {
      const groupsPerNpc = 20;
      const postsPerGroup = POST_MESSAGE_PROBABILITY * TICKS_PER_DAY;
      const totalPosts = groupsPerNpc * postsPerGroup;

      // Should see 200-400 posts per day across all groups
      expect(totalPosts).toBeGreaterThan(200);
      expect(totalPosts).toBeLessThan(400);
      // This is manageable (not overwhelming)
    });

    test('group chat dynamics are slow and realistic', () => {
      // Per NPC per day:
      const joinsPerDay = NPC_JOIN_PROBABILITY * TICKS_PER_DAY;
      const leavesPerDay = NPC_LEAVE_PROBABILITY * TICKS_PER_DAY;
      const postsPerGroupPerDay = POST_MESSAGE_PROBABILITY * TICKS_PER_DAY;

      // All should be close to 1 (slow dynamics)
      expect(joinsPerDay).toBeCloseTo(1, 0.1);
      expect(leavesPerDay).toBeCloseTo(1, 0.1);
      
      // Posts per group should be 10-20 per day
      expect(postsPerGroupPerDay).toBeGreaterThan(10);
      expect(postsPerGroupPerDay).toBeLessThan(20);
    });
  });

  describe('Edge Cases', () => {
    test('probabilities are never negative', () => {
      expect(BASE_KICK_PROBABILITY).toBeGreaterThan(0);
      expect(NPC_JOIN_PROBABILITY).toBeGreaterThan(0);
      expect(NPC_LEAVE_PROBABILITY).toBeGreaterThan(0);
      expect(POST_MESSAGE_PROBABILITY).toBeGreaterThan(0);
    });

    test('probabilities are never > 1', () => {
      expect(BASE_KICK_PROBABILITY).toBeLessThan(1);
      expect(NPC_JOIN_PROBABILITY).toBeLessThan(1);
      expect(NPC_LEAVE_PROBABILITY).toBeLessThan(1);
      expect(POST_MESSAGE_PROBABILITY).toBeLessThan(1);
    });

    test('probabilities are small (not guaranteed events)', () => {
      expect(BASE_KICK_PROBABILITY).toBeLessThan(0.01);
      expect(NPC_JOIN_PROBABILITY).toBeLessThan(0.01);
      expect(POST_MESSAGE_PROBABILITY).toBeLessThan(0.05);
    });

    test('multipliers create reasonable kick times', () => {
      const multipliers = [1, 3, 5, 10, 20, 100];
      
      for (const mult of multipliers) {
        const kickProb = BASE_KICK_PROBABILITY * mult;
        const expectedTicks = 1 / kickProb;
        const expectedDays = expectedTicks / TICKS_PER_DAY;

        // All should result in kick within 30 days
        expect(expectedDays).toBeLessThan(30);
        // All should be positive
        expect(expectedDays).toBeGreaterThan(0);
      }
    });
  });
});

