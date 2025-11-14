# OAuth Setup Guide for Piks

## ✅ Quick Setup Checklist

### 1. Add NEXTAUTH_SECRET (Required)
Your generated secret: `gGAzssUg6JURpYvCCi4oXj0Oz9hswZOOs9NsT+nYlYU=`

1. Click **Tools** → **Secrets** in Replit
2. Click **New Secret**
3. Add:
   - Key: `NEXTAUTH_SECRET`
   - Value: `gGAzssUg6JURpYvCCi4oXj0Oz9hswZOOs9NsT+nYlYU=`
4. Click **Add Secret**

---

## 🔵 Google OAuth Setup (Recommended - Easiest)

### Get Credentials
1. Go to: https://console.cloud.google.com/
2. Create/select a project
3. Enable Google+ API
4. Create OAuth credentials:
   - Type: **Web application**
   - Authorized origins: `https://[your-replit-url].replit.dev`
   - Redirect URI: `https://[your-replit-url].replit.dev/api/auth/callback/google`
5. Copy Client ID and Client Secret

### Add to Replit Secrets
1. `GOOGLE_CLIENT_ID` → (your Client ID)
2. `GOOGLE_CLIENT_SECRET` → (your Client Secret)
3. `NEXT_PUBLIC_GOOGLE_ENABLED` → `true`

---

## 🔷 Facebook OAuth Setup (Easy)

### Get Credentials
1. Go to: https://developers.facebook.com/
2. Create an app (Use case: Authentication)
3. Add Facebook Login → Web
4. Configure OAuth redirect:
   - URI: `https://[your-replit-url].replit.dev/api/auth/callback/facebook`
5. Get App ID and App Secret from Settings → Basic
6. **Switch app to Live mode** (toggle at top)

### Add to Replit Secrets
1. `FACEBOOK_CLIENT_ID` → (your App ID)
2. `FACEBOOK_CLIENT_SECRET` → (your App Secret)
3. `NEXT_PUBLIC_FACEBOOK_ENABLED` → `true`

---

## 🍎 Apple OAuth Setup (Advanced - Optional)

**Note:** Requires Apple Developer account ($99/year). Recommended to skip unless needed.

### Get Credentials
1. Go to: https://developer.apple.com/account
2. Create App ID with "Sign in with Apple" enabled
3. Create Service ID:
   - Domain: `[your-replit-url].replit.dev`
   - Return URL: `https://[your-replit-url].replit.dev/api/auth/callback/apple`
4. Create a Key for "Sign in with Apple"
5. Download .p8 key file (only available once!)

### Add to Replit Secrets
1. `APPLE_ID` → (your Service ID)
2. `APPLE_SECRET` → (requires JWT generation from .p8 key - complex)
3. `NEXT_PUBLIC_APPLE_ENABLED` → `true`

**Apple OAuth requires additional JWT setup. Recommended to start with Google/Facebook first.**

---

## 🚀 Testing Your OAuth Setup

### After Adding Secrets:
1. **Restart the dev server** (it will reload with new environment variables)
2. Go to `/auth` page
3. You should see OAuth buttons for providers you configured
4. Click a button to test the OAuth flow
5. You should be redirected to the provider's login
6. After login, you'll be redirected back to `/dashboard`

### Troubleshooting:
- **Button doesn't appear**: Make sure you added `NEXT_PUBLIC_[PROVIDER]_ENABLED=true`
- **500 error on click**: Check that Client ID and Secret are correct
- **Redirect error**: Verify redirect URIs match exactly in provider settings
- **"Configuration error"**: Ensure NEXTAUTH_SECRET is set

---

## 📝 Important URLs

Replace `[your-replit-url]` with your actual Replit URL (e.g., `piks-abc123.replit.dev`)

- **Google Redirect**: `https://[your-replit-url].replit.dev/api/auth/callback/google`
- **Facebook Redirect**: `https://[your-replit-url].replit.dev/api/auth/callback/facebook`
- **Apple Redirect**: `https://[your-replit-url].replit.dev/api/auth/callback/apple`

---

## 🎯 Recommended Setup Order

1. ✅ Start with **NEXTAUTH_SECRET** (required)
2. ✅ Add **Google** (easiest, most users have Google accounts)
3. ✅ Add **Facebook** (optional, good for broad reach)
4. ⏭️ Skip **Apple** for now (complex setup, unless specifically needed)

---

## 🔒 Security Notes

- Never commit secrets to your repository
- Secrets in Replit are encrypted and secure
- Each provider requires separate OAuth app configuration
- Test thoroughly before deploying to production
