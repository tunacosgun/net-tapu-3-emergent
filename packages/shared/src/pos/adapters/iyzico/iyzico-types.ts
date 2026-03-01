// ── iyzico API Request / Response Types ─────────────────────
// Ref: https://dev.iyzipay.com/

export interface IyzicoConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  callbackUrl: string;
}

/** Common buyer info required by iyzico */
export interface IyzicoBuyer {
  id: string;
  name: string;
  surname: string;
  email: string;
  identityNumber: string;
  registrationAddress: string;
  ip: string;
  city: string;
  country: string;
  gsmNumber?: string;
}

/** Basket item */
export interface IyzicoBasketItem {
  id: string;
  name: string;
  category1: string;
  itemType: 'PHYSICAL' | 'VIRTUAL';
  price: string;
}

/** Checkout form initialize request */
export interface IyzicoCheckoutInitRequest {
  locale?: string;
  conversationId: string;
  price: string;
  paidPrice: string;
  currency: 'TRY' | 'EUR' | 'USD' | 'GBP';
  basketId: string;
  paymentGroup: 'PRODUCT' | 'LISTING' | 'SUBSCRIPTION';
  callbackUrl: string;
  buyer: IyzicoBuyer;
  shippingAddress: {
    contactName: string;
    city: string;
    country: string;
    address: string;
  };
  billingAddress: {
    contactName: string;
    city: string;
    country: string;
    address: string;
  };
  basketItems: IyzicoBasketItem[];
}

/** Checkout form initialize response */
export interface IyzicoCheckoutInitResponse {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
}

/** Checkout form auth (retrieve) request */
export interface IyzicoCheckoutAuthRequest {
  locale?: string;
  conversationId: string;
  token: string;
}

/** Checkout form auth response */
export interface IyzicoCheckoutAuthResponse {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  paymentId?: string;
  paymentStatus?: string;
  price?: number;
  paidPrice?: number;
  currency?: string;
  fraudStatus?: number;
  token?: string;
  conversationId?: string;
}

/** Payment approve (capture) request */
export interface IyzicoApproveRequest {
  locale?: string;
  conversationId: string;
  paymentTransactionId: string;
}

/** Payment approve response */
export interface IyzicoApproveResponse {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  paymentId?: string;
}

/** Refund request */
export interface IyzicoRefundRequest {
  locale?: string;
  conversationId: string;
  paymentTransactionId: string;
  price: string;
  currency: 'TRY' | 'EUR' | 'USD' | 'GBP';
  ip: string;
}

/** Refund response */
export interface IyzicoRefundResponse {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  paymentId?: string;
  paymentTransactionId?: string;
  price?: number;
}
