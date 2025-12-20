# Setup Guide

## Environment Variables

Make sure you have the following environment variables set in your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Important:** The `SUPABASE_SERVICE_ROLE_KEY` is required for the job tracker API to work properly. This key bypasses Row Level Security (RLS) policies, which is necessary for server-side operations.

## Database Setup

1. Run the SQL migration in `supabase-migration.sql` in your Supabase SQL Editor.
2. This will create the `job_tracker` table with proper RLS policies.

## Google OAuth Setup

To enable Google OAuth authentication:

1. Go to your Supabase Dashboard → Authentication → Providers
2. Enable the "Google" provider
3. Add your Google OAuth credentials:
   - **Client ID**: Get this from [Google Cloud Console](https://console.cloud.google.com/)
   - **Client Secret**: Get this from Google Cloud Console
4. In Google Cloud Console:
   - Create a new OAuth 2.0 Client ID (if you don't have one)
   - Add authorized redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`
   - You can find your project ref in your Supabase project settings
5. Save the credentials in Supabase

## Password Reset

The forgot password functionality is already implemented. Users will receive a reset link via email that redirects to `/reset-password`.

Make sure your Supabase project has email templates configured:
- Go to Authentication → Email Templates
- Customize the "Reset Password" template if needed

## Testing

1. **Regular Login/Signup**: Test with email and password
2. **Google OAuth**: Click "Sign in with Google" or "Sign up with Google"
3. **Forgot Password**: Click "Forgot password?" on the login page
4. **Job Tracker**: After a scan, check that jobs are saved to the tracker

