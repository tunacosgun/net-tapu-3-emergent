// ── iyzico Error Code Mapping ──────────────────────────────

export class IyzicoApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: string,
    public readonly rawResponse?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'IyzicoApiError';
  }
}

export function mapIyzicoError(errorCode: string | undefined, errorMessage: string | undefined): string {
  if (errorMessage) return errorMessage;
  if (!errorCode) return 'Unknown iyzico error';
  return `iyzico error code: ${errorCode}`;
}
