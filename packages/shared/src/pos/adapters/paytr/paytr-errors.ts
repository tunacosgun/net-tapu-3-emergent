// ── PayTR Error Code Mapping ──────────────────────────────

/** Known PayTR error codes and human-readable descriptions */
const PAYTR_ERROR_MAP: Record<string, string> = {
  '1': 'Card holder or bank refused',
  '2': 'Card declined (suspected fraud)',
  '3': 'Invalid merchant',
  '4': 'Card stolen',
  '5': 'Card expired',
  '6': 'Invalid CVV',
  '7': 'Insufficient funds',
  '8': 'Card limit exceeded',
  '9': 'Bank system error',
  '10': '3D Secure authentication failed',
  '11': 'Transaction not permitted',
  '12': 'Communication error',
  '13': 'Invalid amount',
  '14': 'Invalid card number',
  '15': 'Card issuer not found',
};

export function mapPaytrErrorCode(code: string | undefined): string {
  if (!code) return 'Unknown error';
  return PAYTR_ERROR_MAP[code] || `PayTR error code: ${code}`;
}

export class PaytrApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: string,
    public readonly rawResponse?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PaytrApiError';
  }
}
