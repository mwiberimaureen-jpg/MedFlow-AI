# Google OAuth Setup Guide

## Enable Google OAuth in Supabase

To enable "Continue with Google" on your login and signup pages, follow these steps:

### Step 1: Configure Google OAuth in Supabase

1. **Go to Supabase Dashboard**:
   - Visit: https://supabase.com/dashboard/project/fxxykjjzyqkbyuehkfsa
   - Navigate to: **Authentication** → **Providers**

2. **Enable Google Provider**:
   - Find "Google" in the list of providers
   - Toggle it **ON**
   - Click "Save"

### Step 2: Get Google OAuth Credentials

You need to create a Google Cloud project and OAuth credentials:

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/

2. **Create a new project** (or select existing):
   - Click "Select a project" → "New Project"
   - Name: "MedFlow AI"
   - Click "Create"

3. **Enable Google+ API**:
   - Go to: **APIs & Services** → **Library**
   - Search for "Google+ API"
   - Click "Enable"

4. **Create OAuth Credentials**:
   - Go to: **APIs & Services** → **Credentials**
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "MedFlow AI OAuth"

5. **Configure Authorized URLs**:

   **Authorized JavaScript origins**:
   ```
   https://fxxykjjzyqkbyuehkfsa.supabase.co
   http://localhost:3000
   https://medflow-ai-psi.vercel.app
   ```

   **Authorized redirect URIs**:
   ```
   https://fxxykjjzyqkbyuehkfsa.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   https://medflow-ai-psi.vercel.app/auth/callback
   ```

6. **Copy Credentials**:
   - Copy the **Client ID**
   - Copy the **Client Secret**

### Step 3: Add Credentials to Supabase

1. **Back in Supabase Dashboard**:
   - Go to: **Authentication** → **Providers** → **Google**

2. **Enter Credentials**:
   - Paste **Client ID** into the "Client ID" field
   - Paste **Client Secret** into the "Client Secret" field
   - Click "Save"

### Step 4: Test the Integration

1. **Local Testing**:
   - Start your dev server: `npm run dev`
   - Visit: http://localhost:3000/login
   - Click "Continue with Google"
   - Sign in with your Google account
   - You should be redirected to /dashboard

2. **Production Testing**:
   - Visit: https://medflow-ai-psi.vercel.app/login
   - Click "Continue with Google"
   - Verify the flow works

### Troubleshooting

**Error: "redirect_uri_mismatch"**
- Make sure all redirect URIs are added to Google Cloud Console
- Check that the URLs match exactly (including http/https)

**Error: "Access blocked"**
- Your app needs to be verified by Google for production use
- For testing, add test users in Google Cloud Console

**Users not appearing in database**
- Check that the `handle_new_user()` trigger is working
- Verify the trigger exists in Supabase: **Database** → **Functions**

### Security Notes

- Never commit Google OAuth credentials to git
- Use different credentials for dev/staging/production
- Regularly rotate your Client Secret
- Monitor OAuth usage in Google Cloud Console

---

## What Happens When a User Signs in with Google?

1. User clicks "Continue with Google"
2. Redirected to Google login page
3. User authorizes MedFlow AI
4. Google redirects back to your app with auth code
5. Supabase exchanges code for user info
6. User profile is created (via `handle_new_user` trigger)
7. User gets 7-day trial automatically
8. User is redirected to /dashboard

---

## Next Steps

After setting up Google OAuth:

1. Test signup with Google account
2. Verify user appears in Supabase Users table
3. Check that trial period is set correctly
4. Test payment flow with Google-authenticated user
5. Monitor for any OAuth errors in Supabase logs
