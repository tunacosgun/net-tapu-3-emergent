import {
  PricingStrategy,
  PricingContext,
  PricingResult,
} from './pricing-strategy.interface';

/**
 * Base pricing strategy: percentage increase with configurable rounding.
 *
 * Params:
 *  - percent: number (e.g. 10 for 10% increase)
 *  - roundUp: boolean (default true) — round to nearest unit
 *  - roundUnit: number (default 1000) — rounding granularity (e.g. 1000 TRY)
 */
export class BasePricingStrategy implements PricingStrategy {
  readonly name = 'base_percentage';

  calculate(
    context: PricingContext,
    params: Record<string, unknown>,
  ): PricingResult {
    const percent = Number(params.percent ?? 0);
    const roundUp = params.roundUp !== false;
    const roundUnit = Number(params.roundUnit ?? 1000);

    if (percent === 0) {
      return {
        newPrice: context.currentPrice,
        changePercent: 0,
        appliedStrategy: this.name,
        metadata: { reason: 'zero_percent' },
      };
    }

    const multiplier = 1 + percent / 100;
    let newPrice = context.currentPrice * multiplier;

    // Apply rounding
    if (roundUp && roundUnit > 0) {
      newPrice = Math.ceil(newPrice / roundUnit) * roundUnit;
    }

    // Ensure price never goes below 0
    newPrice = Math.max(0, newPrice);

    const actualPercent =
      context.currentPrice > 0
        ? ((newPrice - context.currentPrice) / context.currentPrice) * 100
        : 0;

    return {
      newPrice,
      changePercent: parseFloat(actualPercent.toFixed(4)),
      appliedStrategy: this.name,
      metadata: {
        requestedPercent: percent,
        roundUp,
        roundUnit,
        priceBeforeRounding: context.currentPrice * multiplier,
      },
    };
  }
}
