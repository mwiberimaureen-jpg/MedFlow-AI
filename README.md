# MedFlow AI App

AI-powered patient history analysis tool for medical professionals. Analyze patient histories and get structured diagnostic suggestions with intelligent to-do lists.

## Features

- 🏥 **Patient History Analysis**: Upload patient histories and get AI-powered diagnostic suggestions
- ✅ **Structured To-Do Lists**: Organized action items for patient care (exams, tests, management)
- 💳 **Subscription Management**: Monthly subscriptions via Intasend (M-PESA, Card payments)
- 🔐 **Secure Authentication**: Supabase Auth with row-level security
- 📊 **Usage Tracking**: Monitor your analysis quota and patient records
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Payments**: Intasend (Kenyan payment gateway)
- **AI**: OpenAI GPT-4 for patient history analysis
- **Deployment**: Vercel (recommended)

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- Intasend account (for payments)
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   cd medflow-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

   Fill in your credentials:
   ```bash
   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # Intasend
   INTASEND_PUBLISHABLE_KEY=your_publishable_key
   INTASEND_SECRET_KEY=your_secret_key
   INTASEND_WEBHOOK_SECRET=your_webhook_secret

   # OpenAI
   OPENAI_API_KEY=your_openai_key
   ```

4. **Run Supabase migrations**
   ```bash
   # Navigate to supabase directory
   cd ../supabase

   # Apply migrations (requires Supabase CLI)
   supabase db push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Payment Integration

This app uses **Intasend** for subscription payments (KES 2,000/month).

### Setup Instructions

See detailed setup guide: [PAYMENT_SETUP.md](./PAYMENT_SETUP.md)

**Quick summary:**

1. Get Intasend API keys from [dashboard.intasend.com](https://dashboard.intasend.com)
2. Add keys to `.env.local`
3. Configure webhook URL: `https://yourdomain.com/api/payments/webhook`
4. Test with test mode credentials

### Payment Flow

1. User visits `/pricing` and clicks "Subscribe"
2. API creates Intasend checkout session
3. User completes payment (M-PESA/Card)
4. Intasend webhook activates subscription
5. User redirected to `/payment/success`

## Project Structure

```
medflow-ai/
├── app/
│   ├── api/
│   │   └── payments/
│   │       ├── create-checkout/   # Create payment session
│   │       └── webhook/            # Handle payment callbacks
│   ├── pricing/                    # Subscription pricing page
│   ├── payment/
│   │   ├── success/                # Payment success page
│   │   └── failed/                 # Payment failure page
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── intasend/
│   │   └── client.ts               # Intasend API wrapper
│   ├── supabase/
│   │   ├── client.ts               # Client-side Supabase
│   │   └── server.ts               # Server-side Supabase
│   └── hooks/
│       └── useUser.ts              # User/subscription hook
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_row_level_security.sql
│       └── 003_database_functions.sql
└── PAYMENT_SETUP.md
```

## Database Schema

### Key Tables

- **users**: User profiles with subscription status
- **subscriptions**: Payment transaction records
- **patient_histories**: Uploaded patient data
- **analyses**: AI-generated diagnostic suggestions
- **todo_items**: Structured to-do list items
- **payment_webhooks**: Webhook event logs

### Key Functions

- `create_subscription()`: Activate subscription
- `get_user_subscription_status()`: Check subscription state
- `create_analysis()`: Store AI analysis results
- `expire_subscriptions()`: Cron job to expire old subscriptions

## API Routes

### Payment APIs

- `POST /api/payments/create-checkout` - Create payment session
- `POST /api/payments/webhook` - Handle Intasend webhooks

### Usage

```typescript
// Create checkout session
const response = await fetch('/api/payments/create-checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-uuid',
    email: 'user@example.com',
    fullName: 'John Doe',
  }),
});

const { checkoutUrl } = await response.json();
window.location.href = checkoutUrl;
```

## Development

### Running locally

```bash
npm run dev
```

### Building for production

```bash
npm run build
npm start
```

### Testing payments

Use Intasend test mode:
- M-PESA: Phone `254700000000`, any PIN
- Card: `4242424242424242`, any expiry/CVC

### Webhook testing

For local webhook testing, use ngrok:

```bash
# Terminal 1: Run app
npm run dev

# Terminal 2: Expose with ngrok
ngrok http 3000

# Use ngrok URL in Intasend webhook settings
```

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment variables checklist

- [ ] `NEXT_PUBLIC_APP_URL` (production URL)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `INTASEND_PUBLISHABLE_KEY` (production)
- [ ] `INTASEND_SECRET_KEY` (production)
- [ ] `INTASEND_WEBHOOK_SECRET`
- [ ] `OPENAI_API_KEY`

### Post-deployment

1. Update Intasend webhook URL to production domain
2. Test payment flow end-to-end
3. Verify webhook signature validation
4. Monitor payment_webhooks table for errors

## Security

- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ Supabase Row Level Security (RLS)
- ✅ Service role key for admin operations
- ✅ Environment variable validation
- ✅ HTTPS required for webhooks
- ✅ Audit trail for all payments

## Troubleshooting

### Payment not activating

Check webhook logs:
```sql
SELECT * FROM payment_webhooks WHERE status = 'failed';
```

### Subscription status not updating

Verify `create_subscription()` function exists and RLS policies allow updates.

### Webhook not received

1. Check webhook URL is publicly accessible
2. Verify webhook secret matches
3. Check server logs for errors

## Support

- **Payment Issues**: support@intasend.com
- **Technical Issues**: Check [PAYMENT_SETUP.md](./PAYMENT_SETUP.md)

## License

MIT
