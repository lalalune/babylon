/**
 * Admin Signal Analysis API
 * 
 * @route GET /api/admin/signal-analysis
 * @access ADMIN ONLY
 * 
 * @description
 * Internal debugging endpoint for admins to view signal analysis.
 * 
 * ⚠️ SECURITY: This reveals secret game data and must NEVER be exposed
 * to regular users or agents. Admin authentication required.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { asSystem } from '@/lib/db/context';
import { SignalExtractionService } from '@/lib/services/signal-extraction-service';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);
  
  // Verify admin status
  const dbUser = await asSystem(async (db) => {
    return await db.user.findUnique({
      where: { id: user.userId },
      select: { isAdmin: true },
    });
  }, 'admin-signal-analysis');

  if (!dbUser?.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const questionNumber = searchParams.get('questionNumber');

  if (!questionNumber) {
    return NextResponse.json(
      { error: 'questionNumber parameter required' },
      { status: 400 }
    );
  }

  // Extract signal (admin only, for debugging)
  const signal = await SignalExtractionService.extractMarketSignal(parseInt(questionNumber, 10));

  return NextResponse.json({
    success: true,
    signal,
    warning: 'This data is for admin debugging only. Never expose to agents.',
  });
});

