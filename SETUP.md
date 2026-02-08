# MedFlow AI App - Setup Instructions

A subscription-based medical patient history analysis application built with Next.js 15, Supabase Auth, and Tailwind CSS.

## Features

✅ Next.js 15 with App Router
✅ TypeScript
✅ Tailwind CSS v4
✅ Supabase Authentication
✅ Protected routes with middleware
✅ Clean medical-professional UI (blues/greens theme)
✅ Dashboard with sidebar navigation
✅ Auth pages: Login, Signup, Forgot Password
✅ Logout functionality

## Getting Started

### 1. Install Dependencies

```bash
cd c:\Users\admin\OneDrive\Desktop\Workspace\medflow-ai
npm install
```

### 2. Set Up Supabase

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Wait for your project to be provisioned
3. Go to Project Settings > API
4. Copy your project URL and anon/public key

### 3. Configure Environment Variables

Edit the `.env.local` file and replace the placeholder values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
medflow-ai/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   ├── signup/
│   │   │   └── page.tsx          # Signup page
│   │   ├── forgot-password/
│   │   │   └── page.tsx          # Forgot password page
│   │   └── layout.tsx            # Auth layout
│   ├── dashboard/
│   │   ├── layout.tsx            # Dashboard layout with sidebar
│   │   └── page.tsx              # Dashboard home
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page (redirects to login/dashboard)
│   └── globals.css               # Global styles
├── components/
│   └── Sidebar.tsx               # Sidebar navigation component
├── lib/
│   └── supabase/
│       ├── client.ts             # Client-side Supabase client
│       ├── server.ts             # Server-side Supabase client
│       └── middleware.ts         # Middleware utility
├── middleware.ts                 # Next.js middleware for route protection
├── .env.local                    # Environment variables (gitignored)
├── .env.example                  # Environment template
└── package.json
```

## Routes

### Public Routes
- `/login` - User login
- `/signup` - New user registration
- `/forgot-password` - Password reset

### Protected Routes
- `/dashboard` - Main dashboard (requires authentication)
- All `/dashboard/*` routes are protected

## Authentication Flow

1. Users must sign up or log in to access the app
2. Middleware checks authentication status on every request
3. Unauthenticated users are redirected to `/login`
4. Authenticated users accessing auth pages are redirected to `/dashboard`
5. Users can logout from the sidebar

## Supabase Setup

### Enable Email Authentication

1. In your Supabase dashboard, go to Authentication > Providers
2. Enable Email provider
3. Configure email templates (optional)

### Email Confirmation

By default, Supabase requires email confirmation. To disable for development:

1. Go to Authentication > Settings
2. Disable "Enable email confirmations"

## UI Theme

The app uses a clean, professional medical theme:
- **Primary colors**: Blues (#1e40af, #3b82f6)
- **Secondary colors**: Greens (#059669, #10b981)
- **Background**: Light gradients (blue-50 to green-50)
- **Typography**: Clean, readable fonts with good hierarchy

## Next Steps

1. **Set up Supabase tables** for patient data
2. **Create patient management pages** under `/dashboard/patients`
3. **Add analysis features** under `/dashboard/analysis`
4. **Implement subscription logic** (Stripe integration)
5. **Add user profile settings** under `/dashboard/settings`

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run linter
npm run lint
```

## Technologies

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (recommended)

## Support

For issues or questions, refer to:
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
