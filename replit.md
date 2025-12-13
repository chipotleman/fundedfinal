# Piks - Sports Betting Challenge Platform

## Overview
Piks is a Next.js-based sports betting platform designed to offer users funded challenges for sports betting. Users can participate in various challenge tiers, gain access to funded accounts, and retain a percentage of their profits. The platform aims to provide a comprehensive betting experience, from demo trials to real-money challenges, with a focus on user progression and profit sharing.

## User Preferences
None documented yet.

## System Architecture

### UI/UX Decisions
- **Design Aesthetic**: Clean, professional, minimal with a black background (`#000000`) throughout the site. No purple gradients are used. Glass-morphism card effects are used for a modern look.
- **Logo**: Prominent Piks logo (90px mobile, 115px desktop), centered on mobile and left-aligned on desktop.
- **Mobile Navigation**: Standard hamburger menu (three lines) that transforms into an 'X' to close. Swipe gestures (left to open, right to close) are supported. Menu appears instantly, while the page slides. Body scroll is locked when the menu is open. All hover effects and tap highlights are disabled on mobile for a clean touch experience.
- **Bet Slip**: Floating bet slip button appears on scroll, showing bet count. Mobile bet slip is full-screen (`inset-0`) with no rounded corners, optimized for compact layout.
- **Bet Receipt**: Professional bet confirmation display with auto-dismissal, showing matchup, selection, odds, wager, and potential payout.

### Technical Implementations
- **Framework**: Next.js 14.2.30
- **Styling**: Tailwind CSS
- **State Management**: React Context (AuthContext, BetSlipContext, UserProfilesContext)
- **Authentication**: NextAuth.js v4 with email/password authentication
  - Credentials provider (email/password with bcrypt hashing) - **Active**
  - OAuth providers (Google, Apple, Facebook) - **Disabled** until API credentials are configured
  - JWT-based sessions with 7-day expiry
  - "Remember Me" functionality saves user emails locally
- **Database ORM**: Drizzle ORM with @neondatabase/serverless HTTP driver (Vercel-compatible)
- **Beta Access**: Password-protected beta landing page with access persistence via localStorage.
- **Demo Platform**: Fully functional demo experience with localStorage persistence, allowing users to customize challenge tiers and practice betting without authentication.
- **Challenge Persistence**: Challenge selections and customizations are stored in localStorage post-payment and loaded automatically during authentication, then saved to database via API.

### Feature Specifications
- **Challenge Tiers**:
    - **Starter**: $5,000 funding, $149, 90% profit split (Reward phase)
    - **Pro**: $10,000 funding, $249, 90% profit split (Reward phase)
    - **Elite**: $25,000 funding, $399, 90% profit split (Reward phase)
- **Challenge Phases & Rules**:
    - **Phase 1 & 2**: 20 picks min, 1-5% risk/pick, 10% max daily loss, 15% max drawdown, 20% profit target. 10% pick cashout fee.
    - **Reward Phase**: 20 picks min, 1-5% risk/pick, 10% max daily loss, 15% max drawdown, no profit target, 90% reward split. 5-day inactivity timer.
    - All phases allow same-game parlays. Live picking is a planned feature.
- **Global Popups**: Challenge and How-It-Works popups are globally accessible via `_app.js`.

### System Design Choices
- **Authentication Flow**: Beta access -> NextAuth.js (email/password or OAuth) -> JWT session -> User profile creation (via createUser event) -> Challenge selection & purchase -> Challenge data persistence via API.
- **Database Schema** (Drizzle ORM):
  - `users` - Authentication data (id, email, password hash, emailVerified)
  - `profiles` - User betting data (bankroll, challenge info, stats, bets history)
  - `user_bets` - Individual bet records
  - `accounts`, `sessions`, `verification_tokens` - NextAuth.js required tables
- **API Architecture**: RESTful API routes in `/pages/api/*` for database operations
  - `/api/auth/*` - NextAuth.js endpoints
  - `/api/profiles/[id]` - User profile CRUD operations
  - `/api/auth/signup` - User registration endpoint

## Recent Changes
- **December 13, 2025**:
  - ✅ Created AuthPopup component with Sign In/Sign Up toggle tabs
  - ✅ Added OAuth buttons (Google, Apple, Facebook) - UI ready for future integration
  - ✅ Updated TopNavbar and MobileNavMenu to open auth popup instead of /auth page
  - ✅ Redesigned auth page (pages/auth.js) to match dashboard/popup theme
  - ✅ Rebuilt authentication system for Vercel serverless compatibility
  - ✅ Switched database driver from WebSocket to HTTP-based Neon client
  - ✅ Created auth service layer (lib/auth/service.ts) with proper error handling
  - ✅ Simplified NextAuth configuration with cleaner JWT callbacks
  - ✅ Added Vercel environment setup documentation (VERCEL_ENV_SETUP.md)
- **November 14, 2025**: 
  - ✅ Complete Supabase migration to NextAuth + PostgreSQL
  - ✅ OAuth buttons removed from UI (prevents 500 errors until credentials configured)
  - ✅ Production build verified and ready for Vercel deployment
  - Non-essential features stubbed for future implementation (admin panels, marketplace, profile editing)

## OAuth Setup (Optional)
OAuth sign-in is currently disabled. To enable Google, Apple, or Facebook sign-in:

1. **Add environment secrets** for the provider(s) you want:
   - Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - Apple: `APPLE_ID`, `APPLE_SECRET`
   - Facebook: `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`

2. **Add NEXTAUTH_SECRET**: Required for NextAuth.js session encryption
   - Generate with: `openssl rand -base64 32`

3. **Restore OAuth buttons** in `pages/auth.js` (currently commented out around line 433)

4. **Configure OAuth apps** with your providers and add redirect URLs:
   - Callback URL format: `https://your-domain.com/api/auth/callback/[provider]`

## External Dependencies
- **Authentication**: NextAuth.js v4
- **Database**: Replit PostgreSQL (Neon-backed) via Drizzle ORM
- **Payment Processing**: Stripe (environment variables for keys)