export enum DepositStatus {
  COLLECTED = 'collected',
  HELD = 'held',
  CAPTURED = 'captured',
  REFUND_PENDING = 'refund_pending',
  REFUNDED = 'refunded',
  EXPIRED = 'expired',
}

export enum PaymentStatus {
  PENDING = 'pending',
  AWAITING_3DS = 'awaiting_3ds',
  PROVISIONED = 'provisioned',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
  MAIL_ORDER = 'mail_order',
}

export enum PosProvider {
  PAYTR = 'paytr',
  IYZICO = 'iyzico',
  MOKA = 'moka',
  MOCK = 'mock',
}

export enum LedgerEvent {
  DEPOSIT_COLLECTED = 'deposit_collected',
  DEPOSIT_HELD = 'deposit_held',
  DEPOSIT_CAPTURED = 'deposit_captured',
  DEPOSIT_REFUND_INITIATED = 'deposit_refund_initiated',
  DEPOSIT_REFUNDED = 'deposit_refunded',
  DEPOSIT_EXPIRED = 'deposit_expired',
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_PROVISIONED = 'payment_provisioned',
  PAYMENT_CAPTURED = 'payment_captured',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_PROVISION_CANCELLED = 'payment_provision_cancelled',
  REFUND_INITIATED = 'refund_initiated',
  REFUND_COMPLETED = 'refund_completed',
  THREE_DS_INITIATED = 'three_ds_initiated',
  THREE_DS_CALLBACK_RECEIVED = 'three_ds_callback_received',
  THREE_DS_COMPLETED = 'three_ds_completed',
  THREE_DS_FAILED = 'three_ds_failed',
  RECONCILIATION_MISMATCH = 'reconciliation_mismatch',
  RECONCILIATION_RESOLVED = 'reconciliation_resolved',
}
