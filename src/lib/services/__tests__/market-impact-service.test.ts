import { describe, it, expect } from 'bun:test';
import { aggregateTradeImpacts } from '../market-impact-service';
import type { TradeImpactInput } from '../market-impact-service';

describe('aggregateTradeImpacts', () => {
  it('aggregates perp trades into net sentiment', () => {
    const trades: TradeImpactInput[] = [
      { marketType: 'perp', ticker: 'FOO', side: 'long', size: 5000 },
      { marketType: 'perp', ticker: 'FOO', side: 'short', size: 2000 },
      { marketType: 'perp', ticker: 'BAR', side: 'short', size: 3000 },
    ];

    const impacts = aggregateTradeImpacts(trades);
    const fooImpact = impacts.get('FOO');
    const barImpact = impacts.get('BAR');

    expect(fooImpact?.longVolume).toBe(5000);
    expect(fooImpact?.shortVolume).toBe(2000);
    expect(fooImpact?.netSentiment).toBeCloseTo((5000 - 2000) / 7000);
    expect(barImpact?.netSentiment).toBe(-1);
  });

  it('aggregates prediction trades separately', () => {
    const trades: TradeImpactInput[] = [
      { marketType: 'prediction', marketId: 1, side: 'YES', size: 100 },
      { marketType: 'prediction', marketId: 1, side: 'NO', size: 50 },
    ];

    const impacts = aggregateTradeImpacts(trades);
    const impact = impacts.get('market-1');

    expect(impact?.yesVolume).toBe(100);
    expect(impact?.noVolume).toBe(50);
    expect(impact?.netSentiment).toBeCloseTo((100 - 50) / 150);
  });
});
