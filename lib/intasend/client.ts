/**
 * Intasend API Client
 * Documentation: https://developers.intasend.com/
 */

export interface IntasendConfig {
  publishableKey: string;
  secretKey: string;
  isTest?: boolean;
}

export interface CheckoutSession {
  amount: number;
  currency: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  redirect_url?: string;
  api_ref?: string; // Your internal reference ID
}

export interface CheckoutResponse {
  id: string;
  url: string;
  signature: string;
  api_ref: string;
}

export interface WebhookPayload {
  invoice_id: string;
  state: string; // 'COMPLETE', 'PENDING', 'FAILED'
  provider: string; // 'MPESA', 'CARD', etc.
  charges: string;
  net_amount: string;
  value: string;
  account: string;
  api_ref: string;
  mpesa_reference?: string;
  card_type?: string;
  failed_reason?: string;
  created_at: string;
  updated_at: string;
}

export class IntasendClient {
  private config: IntasendConfig;
  private baseUrl: string;

  constructor(config: IntasendConfig) {
    this.config = config;
    this.baseUrl = config.isTest
      ? 'https://sandbox.intasend.com/api/v1'
      : 'https://payment.intasend.com/api/v1';
  }

  /**
   * Create a checkout session
   */
  async createCheckout(session: CheckoutSession): Promise<CheckoutResponse> {
    const response = await fetch(`${this.baseUrl}/checkout/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.secretKey}`,
      },
      body: JSON.stringify({
        public_key: this.config.publishableKey,
        amount: session.amount,
        currency: session.currency,
        email: session.email,
        first_name: session.first_name,
        last_name: session.last_name,
        phone_number: session.phone_number,
        redirect_url: session.redirect_url,
        api_ref: session.api_ref,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Intasend API Error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Verify webhook signature
   * Intasend sends X-Intasend-Signature header
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(invoiceId: string): Promise<WebhookPayload> {
    const response = await fetch(`${this.baseUrl}/payment/status/${invoiceId}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.secretKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Intasend API Error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }
}

/**
 * Get Intasend client instance
 */
export function getIntasendClient(): IntasendClient {
  const config: IntasendConfig = {
    publishableKey: process.env.INTASEND_PUBLISHABLE_KEY || '',
    secretKey: process.env.INTASEND_SECRET_KEY || '',
    isTest: process.env.NODE_ENV !== 'production',
  };

  if (!config.publishableKey || !config.secretKey) {
    throw new Error('Intasend API keys not configured. Please set INTASEND_PUBLISHABLE_KEY and INTASEND_SECRET_KEY environment variables.');
  }

  return new IntasendClient(config);
}
