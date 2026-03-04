import { BasePricingStrategy } from '../base-pricing.strategy';
import { PricingContext } from '../pricing-strategy.interface';

describe('BasePricingStrategy', () => {
  const strategy = new BasePricingStrategy();

  const baseContext: PricingContext = {
    parcelId: 'p1',
    currentPrice: 1_000_000,
    areaM2: 500,
    city: 'İstanbul',
    district: 'Kadıköy',
  };

  it('should return same price for 0% increase', () => {
    const result = strategy.calculate(baseContext, { percent: 0 });
    expect(result.newPrice).toBe(1_000_000);
    expect(result.changePercent).toBe(0);
    expect(result.appliedStrategy).toBe('base_percentage');
  });

  it('should apply 10% increase', () => {
    const result = strategy.calculate(baseContext, { percent: 10 });
    // 1,000,000 * 1.10 = 1,100,000 → rounded to nearest 1000 = 1,100,000
    expect(result.newPrice).toBe(1_100_000);
    expect(result.changePercent).toBe(10);
  });

  it('should round UP to nearest roundUnit', () => {
    const ctx = { ...baseContext, currentPrice: 1_000_500 };
    const result = strategy.calculate(ctx, { percent: 10, roundUnit: 1000 });
    // 1,000,500 * 1.10 = 1,100,550 → ceil to 1000 = 1,101,000
    expect(result.newPrice).toBe(1_101_000);
  });

  it('should use custom roundUnit', () => {
    const result = strategy.calculate(baseContext, {
      percent: 7,
      roundUnit: 5000,
    });
    // 1,000,000 * 1.07 = 1,070,000 → ceil to 5000 = 1,070,000
    expect(result.newPrice).toBe(1_070_000);
  });

  it('should handle non-round custom roundUnit', () => {
    const ctx = { ...baseContext, currentPrice: 123_456 };
    const result = strategy.calculate(ctx, { percent: 15, roundUnit: 10_000 });
    // 123,456 * 1.15 = 141,974.4 → ceil to 10_000 = 150,000
    expect(result.newPrice).toBe(150_000);
  });

  it('should disable rounding when roundUp is false', () => {
    const ctx = { ...baseContext, currentPrice: 123_456 };
    const result = strategy.calculate(ctx, {
      percent: 10,
      roundUp: false,
    });
    // 123,456 * 1.10 = 135,801.6 (no rounding)
    expect(result.newPrice).toBeCloseTo(135801.6, 1);
  });

  it('should handle negative percentages (price decrease)', () => {
    const result = strategy.calculate(baseContext, { percent: -10 });
    // 1,000,000 * 0.90 = 900,000
    expect(result.newPrice).toBe(900_000);
    expect(result.changePercent).toBe(-10);
  });

  it('should never return negative price', () => {
    const result = strategy.calculate(baseContext, { percent: -200 });
    expect(result.newPrice).toBe(0);
  });

  it('should report actual change percent after rounding', () => {
    const ctx = { ...baseContext, currentPrice: 99_000 };
    const result = strategy.calculate(ctx, { percent: 5, roundUnit: 5000 });
    // 99,000 * 1.05 = 103,950 → ceil to 5000 = 105,000
    expect(result.newPrice).toBe(105_000);
    // Actual: (105000 - 99000) / 99000 * 100 = 6.0606...
    expect(result.changePercent).toBeCloseTo(6.0606, 2);
  });

  it('should include metadata with calculation details', () => {
    const result = strategy.calculate(baseContext, { percent: 10 });
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.requestedPercent).toBe(10);
    expect(result.metadata?.roundUp).toBe(true);
    expect(result.metadata?.roundUnit).toBe(1000);
  });
});
