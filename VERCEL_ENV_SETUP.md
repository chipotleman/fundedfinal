# Vercel Environment Variables Setup

## Required Environment Variables

For authentication to work on Vercel, you MUST set these environment variables in your Vercel project settings:

### 1. NEXTAUTH_SECRET (Required)
A random string used to encrypt JWT tokens and session cookies.

**How to generate:**
```bash
openssl rand -base64 32
```

**Example value:**
```
your-random-32-character-string-here
```

### 2. NEXTAUTH_URL (Required)
The full URL of your deployed application.

**Format:**
```
https://your-app-name.vercel.app
```

**Note:** Do NOT include a trailing slash.

### 3. DATABASE_URL (Required)
Your Neon PostgreSQL connection string. This should already be set if you're using Replit's database.

**Format:**
```
postgresql://user:password@host/database?sslmode=require
```

## How to Set Environment Variables in Vercel

1. Go to your Vercel Dashboard
2. Select your project
3. Click "Settings" tab
4. Click "Environment Variables" in the sidebar
5. Add each variable:
   - Name: `NEXTAUTH_SECRET`
   - Value: Your generated secret
   - Environment: Production (and optionally Preview/Development)
6. Repeat for `NEXTAUTH_URL` and `DATABASE_URL`
7. Click "Save"
8. **Redeploy your application** for changes to take effect

## Troubleshooting

### "Invalid email or password" on deployed site
- Check that `DATABASE_URL` is correctly set and the database is accessible
- Verify the connection string includes `?sslmode=require`

### Session not persisting / immediately logged out
- Ensure `NEXTAUTH_SECRET` is set (must be at least 32 characters)
- Verify `NEXTAUTH_URL` matches your exact deployment URL

### 500 errors on auth endpoints
- Check Vercel function logs for detailed error messages
- Verify all three environment variables are set correctly
- Make sure you redeployed after adding environment variables
