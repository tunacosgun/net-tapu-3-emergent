/**
 * Pluggable pricing strategy interface.
 *
 * Implementations can apply percentage increases, rounding rules,
 * regional adjustments, market-based algorithms, etc.
 *
 * The strategy receives the current price and context, and returns
 * the new calculated price.
 */
export interface PricingContext {
  parcelId: string;
  currentPrice: number;
  areaM2?: number;
  city?: string;
  district?: string;
  landType?: string;
  zoningStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface PricingResult {
  newPrice: number;
  changePercent: number;
  appliedStrategy: string;
  metadata?: Record<string, unknown>;
}

export interface PricingStrategy {
  readonly name: string;

  /**
   * Calculate a new price based on the current price and context.
   * Must NOT have side effects (pure calculation).
   */
  calculate(context: PricingContext, params: Record<string, unknown>): PricingResult;
}

/**
 * Provider token for injecting the active pricing strategy.
 */
export const PRICING_STRATEGY = 'PRICING_STRATEGY';
