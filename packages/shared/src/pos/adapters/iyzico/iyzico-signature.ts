import { createHmac, createHash } from 'crypto';

/**
 * Generate iyzico Authorization header value.
 *
 * iyzico uses a PKI-string + HMAC-SHA256 auth scheme:
 *   1. Build PKI string from request body fields
 *   2. SHA-1 hash of PKI string
 *   3. HMAC-SHA256 of (secretKey + sha1Hash) with secretKey
 *   4. Base64 encode
 *   5. Header: "IYZWS {apiKey}:{base64Signature}"
 */
export function generateIyzicoAuthHeader(
  apiKey: string,
  secretKey: string,
  randomString: string,
  pkiString: string,
): string {
  const sha1Hash = createHash('sha1').update(pkiString).digest('hex');
  const hashStr = apiKey + randomString + secretKey + sha1Hash;
  const signature = createHmac('sha256', secretKey)
    .update(hashStr)
    .digest('base64');

  return `IYZWS ${apiKey}:${signature}`;
}

/**
 * Build PKI (Parameter Key-Value Identifier) string for iyzico.
 * Format: [key=value,key=value,...]
 */
export function buildPkiString(params: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      const items = value.map((item) => {
        if (typeof item === 'object' && item !== null) {
          return buildPkiString(item as Record<string, unknown>);
        }
        return String(item);
      });
      parts.push(`${key}=[${items.join(', ')}]`);
    } else if (typeof value === 'object') {
      parts.push(`${key}=${buildPkiString(value as Record<string, unknown>)}`);
    } else {
      parts.push(`${key}=${value}`);
    }
  }

  return `[${parts.join(',')}]`;
}

/** Generate a random string for iyzico request header */
export function generateRandomString(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
