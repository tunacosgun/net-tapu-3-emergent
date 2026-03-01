import { useState, useEffect, useCallback } from 'react';
import { RateLimitError } from '@/lib/api-client';
import { showRateLimitToast } from '@/components/api-error-toast';

/**
 * Hook for managing 429 rate-limit cooldown state.
 *
 * Usage:
 *   const { cooldown, isLimited, checkRateLimit } = useRateLimit();
 *
 *   catch (err) {
 *     if (!checkRateLimit(err)) showApiError(err);
 *   }
 *
 *   <button disabled={isSubmitting || isLimited}>
 *     {isLimited ? `${cooldown}s bekleyin` : 'Submit'}
 *   </button>
 */
export function useRateLimit() {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]); // only re-run when transitioning between 0 and >0

  const checkRateLimit = useCallback((error: unknown): boolean => {
    if (error instanceof RateLimitError) {
      setCooldown(error.retryAfter);
      showRateLimitToast(error.retryAfter);
      return true;
    }
    return false;
  }, []);

  return {
    /** Seconds remaining in cooldown (0 = not limited) */
    cooldown,
    /** Whether the user is currently rate-limited */
    isLimited: cooldown > 0,
    /** Returns true if the error was a RateLimitError (handled). */
    checkRateLimit,
  } as const;
}
