/**
 * Market Dynamics API
 * 
 * Returns PUBLIC market data - prices, volumes, momentum
 * Safe for competitive MMO - all observable information
 * NO oracle data exposed
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { PredictionPricing } from '@/lib/prediction-pricing';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const questionNumber = parseInt(id);

    // Get question and market:
    const question = await prisma.question.findUnique({
      where: { questionNumber }
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const market = await prisma.market.findUnique({
      where: { id: question.id }
    });

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    // Get positions for volume analysis (public data):
    const positions = await prisma.position.findMany({
      where: {
        marketId: market.id
      },
      orderBy: { resolvedAt: 'asc' },
      take: 1000  // Last 1000 positions
    });

    // For now, use simple price calculation from current market state
    // TODO: Implement full trade history tracking
    const priceHistory: Array<{
      timestamp: string;
      yesPrice: number;
      noPrice: number;
      volume: number;
    }> = [];

    // Current prices:
    const yesShares = Number(market.yesShares);
    const noShares = Number(market.noShares);
    const totalShares = yesShares + noShares;

    const currentYesPrice = totalShares > 0 
      ? PredictionPricing.getCurrentPrice(yesShares, noShares, 'yes')
      : 0.5;

    // Calculate total volume from positions:
    const totalVolume = positions.reduce((sum, p) => {
      return sum + (Number(p.shares) * Number(p.avgPrice));
    }, 0);

    // Simple momentum (price away from 0.5):
    const priceMomentum = currentYesPrice - 0.5;

    // Find largest positions (whale watching):
    const largestPositions = positions
      .sort((a, b) => {
        const aSize = Number(a.shares) * Number(a.avgPrice);
        const bSize = Number(b.shares) * Number(b.avgPrice);
        return bSize - aSize;
      })
      .slice(0, 10)
      .map(p => ({
        side: p.side ? 'YES' : 'NO',
        shares: Number(p.shares),
        avgPrice: Number(p.avgPrice),
        value: Number(p.shares) * Number(p.avgPrice),
        timestamp: p.createdAt.toISOString()
      }));

    return NextResponse.json({
      questionId: questionNumber,
      questionText: question.text,
      status: question.status,
      
      // Current state (PUBLIC):
      currentPrice: {
        yes: Number(currentYesPrice.toFixed(4)),
        no: Number((1 - currentYesPrice).toFixed(4))
      },
      
      // Market dynamics (PUBLIC):
      totalVolume: Number(totalVolume.toFixed(2)),
      totalPositions: positions.length,
      
      // Momentum indicators (PUBLIC):
      momentum: priceMomentum > 0.05 ? 'strong_yes' :
               priceMomentum < -0.05 ? 'strong_no' :
               Math.abs(priceMomentum) > 0.02 ? 'moderate' : 'stable',
      priceChange: Number(priceMomentum.toFixed(4)),
      
      // Volume trend (PUBLIC):
      volumeTrend: totalVolume > 10000 ? 'high' :
                  totalVolume > 1000 ? 'medium' : 'low',
      
      // Conviction indicator (PUBLIC):
      conviction: totalVolume > 10000 && Math.abs(priceMomentum) > 0.05 ? 'high' :
                 totalVolume > 1000 || Math.abs(priceMomentum) > 0.03 ? 'medium' : 'low',
      
      // Price history (PUBLIC):
      priceHistory: priceHistory.slice(-100),  // Last 100 data points (empty for now)
      
      // Whale watching (PUBLIC):
      largestPositions,
      
      // NO ORACLE DATA:
      // outcome: undefined,  ❌ Not included
      // clueStrength: undefined,  ❌ Not included
      // pointsToward: undefined  ❌ Not included
    });

  } catch (error) {
    logger.error('Error fetching market dynamics', error, 'MarketDynamicsAPI');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

