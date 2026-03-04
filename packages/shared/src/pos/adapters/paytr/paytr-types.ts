// ── PayTR API Request / Response Types ─────────────────────
// Ref: https://dev.paytr.com/

export interface PaytrConfig {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  callbackUrl: string;
  okUrl: string;
  failUrl: string;
  testMode: boolean;
}

/** POST https://www.paytr.com/odeme/api/get-token */
export interface PaytrGetTokenRequest {
  merchant_id: string;
  user_ip: string;
  merchant_oid: string;  // our paymentId
  email: string;
  payment_amount: string; // kuruş (integer cents)
  paytr_token: string;    // HMAC hash
  user_basket: string;    // base64 JSON
  no_installment: '0' | '1';
  max_installment: string;
  user_name: string;
  user_address: string;
  user_phone: string;
  merchant_ok_url: string;
  merchant_fail_url: string;
  timeout_limit: string;  // minutes
  currency: 'TL' | 'EUR' | 'USD' | 'GBP' | 'RUB';
  test_mode: '0' | '1';
  debug_on: '0' | '1';
  non_3d?: '0' | '1';
  non3d_test_failed?: '0' | '1';
  /** Card token for tokenized payments */
  card_token?: string;
  /** Pre-auth mode: 1 = capture later */
  payment_type?: 'card' | 'eft';
}

export interface PaytrGetTokenResponse {
  status: 'success' | 'failed';
  token?: string;
  reason?: string;
}

/** PayTR callback POST body (sent to our callback URL) */
export interface PaytrCallbackBody {
  merchant_oid: string;    // our paymentId
  status: 'success' | 'failed';
  total_amount: string;    // kuruş
  hash: string;            // HMAC for verification
  failed_reason_code?: string;
  failed_reason_msg?: string;
  test_mode?: string;
  payment_type?: string;
  currency?: string;
  payment_amount?: string;
}

/** POST https://www.paytr.com/odeme/iade (refund) */
export interface PaytrRefundRequest {
  merchant_id: string;
  merchant_oid: string;
  return_amount: string; // kuruş
  paytr_token: string;
  reference_no?: string;
}

export interface PaytrRefundResponse {
  status: 'success' | 'error';
  is_test?: string;
  merchant_oid?: string;
  return_amount?: string;
  reference_no?: string;
  err_msg?: string;
}
