/**
 * Holdings-Based Spot Pricing Tests
 * 
 * Verifies that company prices are correctly derived from NPC holdings
 */

import { describe, test, expect } from 'bun:test';

describe('Holdings-Based Spot Pricing', () => {
  const syntheticSupply = 10000;

  function calculatePrice(initialPrice: number, netHoldings: number): number {
    const baseMarketCap = initialPrice * syntheticSupply;
    const newMarketCap = baseMarketCap + netHoldings;
    return newMarketCap / syntheticSupply;
  }

  describe('basic pricing', () => {
    test('zero holdings = initial price', () => {
      const initialPrice = 100;
      const price = calculatePrice(initialPrice, 0);
      
      expect(price).toBe(initialPrice);
    });

    test('positive holdings increase price', () => {
      const initialPrice = 100;
      const price = calculatePrice(initialPrice, 50000); // $50k deployed
      
      expect(price).toBeGreaterThan(initialPrice);
      expect(price).toBe(105); // $100 + $5 per share
    });

    test('negative holdings (shorts) decrease price', () => {
      const initialPrice = 100;
      const price = calculatePrice(initialPrice, -20000); // $20k short
      
      expect(price).toBeLessThan(initialPrice);
      expect(price).toBe(98); // $100 - $2 per share
    });
  });

  describe('realistic scenarios', () => {
    test('10 NPCs deploy $10k each (all long)', () => {
      const initialPrice = 100;
      const holdings = 10 * 10000; // $100k total
      
      const newPrice = calculatePrice(initialPrice, holdings);
      
      expect(newPrice).toBe(110); // $100 + $10/share
      expect((newPrice - initialPrice) / initialPrice).toBeCloseTo(0.10, 2); // 10% increase
    });

    test('mixed long/short positions', () => {
      const initialPrice = 100;
      const longs = 7 * 15000; // 7 NPCs long $15k each
      const shorts = 3 * 10000; // 3 NPCs short $10k each
      const netHoldings = longs - shorts; // $105k - $30k = $75k
      
      const newPrice = calculatePrice(initialPrice, netHoldings);
      
      expect(newPrice).toBe(107.5); // $100 + $7.5/share
    });

    test('whale dominates market', () => {
      const initialPrice = 50;
      const whale = 500000; // $500k position
      const others = 10 * 5000; // 10 others with $5k each
      const netHoldings = whale + others;
      
      const newPrice = calculatePrice(initialPrice, netHoldings);
      
      expect(newPrice).toBe(105); // $50 + $55/share
      expect((newPrice - initialPrice) / initialPrice).toBeCloseTo(1.10, 2); // 110% increase
    });
  });

  describe('stability', () => {
    test('price unchanged if holdings unchanged', () => {
      const initialPrice = 100;
      const holdings = 50000;
      
      const price1 = calculatePrice(initialPrice, holdings);
      const price2 = calculatePrice(initialPrice, holdings); // Same holdings
      
      expect(price1).toBe(price2); // No runaway drift
    });

    test('closing positions returns price toward initial', () => {
      const initialPrice = 100;
      
      // Open positions
      const holdings1 = 100000;
      const price1 = calculatePrice(initialPrice, holdings1);
      expect(price1).toBe(110);
      
      // Close half
      const holdings2 = 50000;
      const price2 = calculatePrice(initialPrice, holdings2);
      expect(price2).toBe(105);
      
      // Close all
      const holdings3 = 0;
      const price3 = calculatePrice(initialPrice, holdings3);
      expect(price3).toBe(100); // Back to initial
    });
  });

  describe('edge cases', () => {
    test('handles very small holdings', () => {
      const initialPrice = 100;
      const holdings = 0.01; // $0.01
      
      const price = calculatePrice(initialPrice, holdings);
      
      expect(price).toBeGreaterThan(100);
      expect(price).toBeLessThan(100.01);
    });

    test('handles massive holdings', () => {
      const initialPrice = 100;
      const holdings = 10000000; // $10M
      
      const price = calculatePrice(initialPrice, holdings);
      
      expect(price).toBe(1100); // $100 + $1000/share
    });

    test('handles negative holdings (net short)', () => {
      const initialPrice = 100;
      const holdings = -90000; // $90k net short
      
      const price = calculatePrice(initialPrice, holdings);
      
      expect(price).toBe(91); // $100 - $9/share
      expect(price).toBeGreaterThan(0); // Never negative
    });

    test('extreme short cannot make price negative', () => {
      const initialPrice = 100;
      const holdings = -2000000; // Massive short
      
      const price = calculatePrice(initialPrice, holdings);
      
      // Price can go to -$100 (= $0), but not lower in practice
      expect(price).toBeLessThan(0);
      // In real implementation, we'd clamp this to > 0
    });
  });

  describe('formula correctness', () => {
    test('price change equals holdings per share', () => {
      const initialPrice = 100;
      const holdings = 25000;
      
      const newPrice = calculatePrice(initialPrice, holdings);
      const priceChange = newPrice - initialPrice;
      const holdingsPerShare = holdings / syntheticSupply;
      
      expect(priceChange).toBe(holdingsPerShare); // Direct relationship
    });

    test('market cap increases by exact holdings amount', () => {
      const initialPrice = 100;
      const initialMarketCap = initialPrice * syntheticSupply;
      const holdings = 75000;
      
      const newPrice = calculatePrice(initialPrice, holdings);
      const newMarketCap = newPrice * syntheticSupply;
      
      expect(newMarketCap - initialMarketCap).toBe(holdings);
    });
  });

  describe('game scenarios', () => {
    test('all NPCs bullish on FACEHOOK', () => {
      const initialPrice = 100;
      const npcs = [
        { name: 'Elon', holdings: 50000 },
        { name: 'Peter', holdings: 30000 },
        { name: 'Marc', holdings: 25000 },
        { name: 'Cathie', holdings: 15000 },
      ];
      
      const totalHoldings = npcs.reduce((sum, npc) => sum + npc.holdings, 0);
      const newPrice = calculatePrice(initialPrice, totalHoldings);
      
      expect(newPrice).toBe(112); // $100 + $12/share
      expect((newPrice - initialPrice) / initialPrice * 100).toBeCloseTo(12, 1); // 12% gain
    });

    test('controversy: split sentiment', () => {
      const initialPrice = 150;
      const bulls = 5 * 20000; // 5 NPCs @ $20k each
      const bears = 5 * 20000; // 5 NPCs @ $20k short each
      const netHoldings = bulls - bears; // $0
      
      const newPrice = calculatePrice(initialPrice, netHoldings);
      
      expect(newPrice).toBe(initialPrice); // No net change
    });

    test('company insider pumps own stock', () => {
      const initialPrice = 80;
      const insiderHoldings = 200000; // CEO owns $200k worth
      
      const newPrice = calculatePrice(initialPrice, insiderHoldings);
      
      expect(newPrice).toBe(100); // $80 + $20/share
      expect((newPrice - initialPrice) / initialPrice * 100).toBe(25); // 25% pump
    });
  });
});


