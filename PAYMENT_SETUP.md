# Intasend Payment Integration Setup

This guide will help you set up the Intasend payment gateway for monthly subscriptions.

## Overview

- **Payment Gateway**: Intasend
- **Subscription Plan**: Monthly at KES 2,000/month
- **Payment Methods**: M-PESA, Visa, Mastercard
- **Features**: Automatic subscription activation, webhook handling, payment logging

## Prerequisites

1. Intasend account (sign up at [intasend.com](https://intasend.com))
2. Supabase project with migrations applied
3. Node.js 18+ and npm

## Step 1: Get Intasend API Keys

1. Log in to your Intasend dashboard: https://dashboard.intasend.com/
2. Navigate to **Settings** → **API Keys**
3. Copy your:
   - **Publishable Key** (starts with `ISPubKey_`)
   - **Secret Key** (starts with `ISSecKey_`)
4. Generate a webhook secret (recommended: use a random 32-character string)

## Step 2: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# App URL (update for production)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Intasend
INTASEND_PUBLISHABLE_KEY=ISPubKey_test_xxxxxx
INTASEND_SECRET_KEY=ISSecKey_test_xxxxxx
INTASEND_WEBHOOK_SECRET=your_random_32_char_secret
```

## Step 3: Install Dependencies

```bash
npm install @supabase/supabase-js
```

The Intasend integration uses their REST API directly (no SDK required).

## Step 4: Configure Intasend Webhooks

1. In Intasend dashboard, go to **Settings** → **Webhooks**
2. Add a new webhook with:
   - **URL**: `https://yourdomain.com/api/payments/webhook`
   - **Events**: Select "Payment Completed", "Payment Failed"
   - **Secret**: Use the same `INTASEND_WEBHOOK_SECRET` from your .env

For local development, use [ngrok](https://ngrok.com/) or [localtunnel](https://localtunnel.github.io/www/) to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Run your Next.js app
npm run dev

# In another terminal, expose port 3000
ngrok http 3000

# Use the ngrok URL in Intasend webhook settings
# Example: https://abc123.ngrok.io/api/payments/webhook
```

## Step 5: Test the Integration

### Test Mode

Intasend automatically uses test mode when you use test API keys.

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to: http://localhost:3000/pricing

3. Click "Subscribe Now"

4. You'll be redirected to Intasend checkout page

5. Use test credentials:
   - **M-PESA**: Use phone number `254700000000` with any PIN
   - **Card**: Use card number `4242424242424242`, any future expiry, any CVC

6. Complete the payment

7. You should be redirected to `/payment/success`

8. Check your database:
   ```sql
   -- Verify subscription was created
   SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1;

   -- Verify user status was updated
   SELECT id, email, subscription_status, subscription_expires_at
   FROM users
   WHERE subscription_status = 'active';

   -- Check webhook logs
   SELECT * FROM payment_webhooks ORDER BY created_at DESC;
   ```

## API Routes

### Create Checkout Session

**Endpoint**: `POST /api/payments/create-checkout`

**Request Body**:
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "fullName": "John Doe",
  "phoneNumber": "254712345678"
}
```

**Response**:
```json
{
  "success": true,
  "checkoutUrl": "https://checkout.intasend.com/xyz",
  "subscriptionId": "uuid",
  "apiRef": "SUB_12345678_1234567890"
}
```

### Webhook Handler

**Endpoint**: `POST /api/payments/webhook`

**Headers**:
- `X-Intasend-Signature`: HMAC signature for verification

**Webhook Payload**:
```json
{
  "invoice_id": "INV-123",
  "state": "COMPLETE",
  "provider": "MPESA",
  "value": "2000",
  "net_amount": "1960",
  "charges": "40",
  "account": "254712345678",
  "api_ref": "SUB_12345678_1234567890",
  "mpesa_reference": "ABC123XYZ",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:00:30Z"
}
```

## Database Schema

The integration uses these tables:

- **users**: Stores `subscription_status` and `subscription_expires_at`
- **subscriptions**: Complete subscription history with payment details
- **payment_webhooks**: Logs all webhook events for debugging

Key database functions:
- `create_subscription()`: Activates subscription and updates user status
- `get_user_subscription_status()`: Check current subscription state

## Payment Flow

1. **User clicks "Subscribe"** on pricing page
2. **Frontend** calls `/api/payments/create-checkout`
3. **API** creates pending subscription in database
4. **API** creates Intasend checkout session
5. **User** redirected to Intasend payment page
6. **User** completes payment (M-PESA/Card)
7. **Intasend** sends webhook to `/api/payments/webhook`
8. **Webhook handler** verifies signature
9. **Webhook handler** updates subscription status to "active"
10. **Webhook handler** calls `create_subscription()` function
11. **Database function** updates user status and expiry date
12. **User** redirected to `/payment/success`

## Security Features

1. **Webhook Signature Verification**: HMAC-SHA256 validation
2. **Service Role Key**: Backend uses Supabase service key for admin operations
3. **Idempotency**: Duplicate webhooks are handled gracefully
4. **Audit Trail**: All webhooks logged in `payment_webhooks` table

## Troubleshooting

### Payment not activating

1. Check webhook logs:
   ```sql
   SELECT * FROM payment_webhooks WHERE status = 'failed';
   ```

2. Verify environment variables are set correctly

3. Check webhook signature is being validated

4. Ensure Supabase RPC function `create_subscription` exists

### Webhook not received

1. Verify webhook URL is publicly accessible
2. Check Intasend webhook configuration
3. Test with ngrok/localtunnel for local development
4. Check server logs for errors

### Payment declined

1. In test mode, use correct test credentials
2. In production, verify account has sufficient funds
3. Check payment method is supported (M-PESA/Card)

## Production Checklist

- [ ] Replace test API keys with production keys
- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Configure production webhook URL in Intasend
- [ ] Set up SSL certificate (required for webhooks)
- [ ] Test end-to-end payment flow
- [ ] Set up monitoring for failed payments
- [ ] Configure email notifications for subscription events
- [ ] Enable Supabase Row Level Security policies
- [ ] Review and test error handling
- [ ] Set up backup webhook endpoint (optional)

## Support

- Intasend Documentation: https://developers.intasend.com/
- Intasend Support: support@intasend.com
- Dashboard: https://dashboard.intasend.com/

## Pricing

**Monthly Subscription**: KES 2,000/month
- 100 patient history analyses
- All premium features
- Priority support

To change pricing, update the `MONTHLY_PRICE` constant in:
- `/app/api/payments/create-checkout/route.ts`
- `/app/pricing/page.tsx`
