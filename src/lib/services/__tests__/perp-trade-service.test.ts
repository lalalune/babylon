import { describe, expect, it } from 'bun:test';

import { resolveExitPrice } from '../perp-trade-service';

describe('resolveExitPrice', () => {
  it('prefers engine price when available', () => {
    const exitPrice = resolveExitPrice({
      enginePrice: 155,
      organizationPrice: 150,
      positionPrice: 140,
      entryPrice: 100,
    });

    expect(exitPrice).toBe(155);
  });

  it('falls back to position price when engine price missing', () => {
    const exitPrice = resolveExitPrice({
      organizationPrice: 120,
      positionPrice: 140,
      entryPrice: 100,
    });

    expect(exitPrice).toBe(140);
  });

  it('falls back to organization price when engine and position missing', () => {
    const exitPrice = resolveExitPrice({
      organizationPrice: 130,
      positionPrice: null,
      entryPrice: 100,
    });

    expect(exitPrice).toBe(130);
  });

  it('falls back to entry price when no other sources exist', () => {
    const exitPrice = resolveExitPrice({
      enginePrice: undefined,
      organizationPrice: undefined,
      positionPrice: null,
      entryPrice: 123.45,
    });

    expect(exitPrice).toBe(123.45);
  });
});
