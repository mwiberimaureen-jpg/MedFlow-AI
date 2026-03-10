// Middleware intentionally left empty.
// Auth protection is handled in app/dashboard/layout.tsx (server-side getUser + redirect).
// Vercel's hobby plan has an extremely tight middleware timeout (~1.5s) that
// Supabase client initialization alone can exceed, causing 504 GATEWAY_TIMEOUT.
