import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Generate PayTR HMAC token for API requests.
 *
 * PayTR token formula (get-token):
 *   hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount
 *              + user_basket + no_installment + max_installment + currency + test_mode
 *   paytr_token = base64(hmac_sha256(hash_str + merchant_salt, merchant_key))
 */
export function generatePaytrToken(
  params: {
    merchantId: string;
    userIp: string;
    merchantOid: string;
    email: string;
    paymentAmount: string;
    userBasket: string;
    noInstallment: string;
    maxInstallment: string;
    currency: string;
    testMode: string;
  },
  merchantKey: string,
  merchantSalt: string,
): string {
  const hashStr =
    params.merchantId +
    params.userIp +
    params.merchantOid +
    params.email +
    params.paymentAmount +
    params.userBasket +
    params.noInstallment +
    params.maxInstallment +
    params.currency +
    params.testMode;

  const hmac = createHmac('sha256', merchantKey);
  hmac.update(hashStr + merchantSalt);
  return hmac.digest('base64');
}

/**
 * Generate PayTR HMAC token for refund requests.
 *
 * Refund token formula:
 *   hash_str = merchant_id + merchant_oid + return_amount
 *   paytr_token = base64(hmac_sha256(hash_str + merchant_salt, merchant_key))
 */
export function generatePaytrRefundToken(
  merchantId: string,
  merchantOid: string,
  returnAmount: string,
  merchantKey: string,
  merchantSalt: string,
): string {
  const hashStr = merchantId + merchantOid + returnAmount;
  const hmac = createHmac('sha256', merchantKey);
  hmac.update(hashStr + merchantSalt);
  return hmac.digest('base64');
}

/**
 * Verify PayTR callback hash using timing-safe comparison.
 *
 * Callback hash formula:
 *   hash_str = merchant_oid + merchant_salt + status + total_amount
 *   expected  = base64(hmac_sha256(hash_str, merchant_key))
 */
export function verifyPaytrCallbackHash(
  merchantOid: string,
  status: string,
  totalAmount: string,
  receivedHash: string,
  merchantKey: string,
  merchantSalt: string,
): boolean {
  const hashStr = merchantOid + merchantSalt + status + totalAmount;
  const hmac = createHmac('sha256', merchantKey);
  hmac.update(hashStr);
  const expected = hmac.digest('base64');

  // Timing-safe comparison to prevent timing attacks
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(receivedHash, 'utf8');

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
