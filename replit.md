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
- **Global Popups**: Challenge, How-It-Works, Demo, Auth, and Session Summary popups are globally accessible via `_app.js`.
- **Session Summary Popup**: Displays when user signs out, showing session duration, bets placed, wins/losses, pending bets, profit/loss, and challenge info. After closing, redirects to home page.

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

## Admin Panel
- **Access**: `/admin-panel/login`
- **Credentials**: `admin@piks.com` / `AdminPiks2024!`
- **Features**:
  - Dashboard with platform stats (users, bets, challenges)
  - User management with search, clickable rows, multi-select, CSV export, and password reset
  - **User Activity Modal**: View detailed user activity timeline with bets, events, page views, and sessions
  - Bet management with edit/settle functionality
  - Staff management with roles (admin, manager, staff) and granular permissions
  - Analytics dashboard showing events, sessions, page views, demo bets, and unplaced bets
- **Staff Roles & Permissions**:
  - admin: Full access to all features
  - manager: Can manage users and view analytics
  - staff: Basic access to user management
  - Permissions: users:read, users:write, users:delete, bets:read, bets:write, staff:read, staff:write, analytics:read
- **API Routes**: `/api/admin-panel/*` (auth, stats, users, bets, staff, analytics)
- **Database**: Uses `admin_users` for super admin and `admin_staff` for staff accounts

## User Tracking & Analytics
- **Event Tracking**: All user interactions tracked via `user_events` table
- **Session Metrics**: Session duration, pages viewed, events count via `session_metrics` table
- **Page Views**: Detailed page view tracking with time on page and scroll depth via `page_views` table
- **Demo Bets**: All demo betting activity tracked via `demo_bets` table
- **Unplaced Bets**: Bets added to slip but not placed tracked via `unplaced_bets` table
- **Client Hook**: `useEventTracking.js` provides trackEvent, trackPageView, trackDemoBet, trackUnplacedBet functions
- **APIs**: `/api/analytics/*` (events, page-view, demo-bet, unplaced-bet, session)

## Recent Changes
- **December 14, 2025**:
  - ✅ **FEATURE: User Activity Modal** - Admin can view detailed user activity from User Management page with tabs for timeline, bets, events, and sessions. Shows balance snapshots (before/after) for each bet.
  - ✅ **FEATURE: BetSlip Event Tracking** - BetSlip now tracks bet_added, bet_removed, stake_updated events with user/session context
  - ✅ **FEATURE: Balance Snapshots** - Bet placement API records balanceBefore and balanceAfter for each bet
  - ✅ **API: User Activity Endpoint** - `/api/admin-panel/user-activity?userId=xxx` returns complete user activity data
  - ✅ **BUG FIX: UI Balance Refresh** - Fixed bankroll not updating in UI after bet placement by handling numeric string coercion in BetSlip.js and dashboard.js
  - ✅ **FEATURE: Analytics Integration** - Integrated useEventTracking hook globally in _app.js via AnalyticsTracker component for automatic page view and click tracking
  - ✅ **BUG FIX: Session Analytics API** - Fixed ON CONFLICT issue in session.js by checking for existing session before insert
  - ✅ **FEATURE: My Challenge Navigation** - Navigation now shows "My Challenge" instead of "Free Trial" when user has an active challenge
  - ✅ **FEATURE: MyChallengePopup** - New popup (components/MyChallengePopup.js) shows challenge progress, stats, rules, and navigation buttons
  - ✅ **FEATURE: Withdrawal Page** - New page (pages/withdrawal.js) with 5 payment methods (Bank Transfer, Instant Transfer, Venmo, Wire, Check)
  - ✅ **CHANGE: Balance Click** - Clicking balance now navigates to withdrawal page instead of opening balance modal
  - ✅ **Global Popups**: MyChallengePopup registered in _app.js with 'openMyChallengePopup' event
  - ✅ **BUG FIX: Admin Panel Logo** - Updated to use `/pikslogotransparent.png` with doubled sizes (login: h-28, sidebar: h-16)
  - ✅ **BUG FIX: Admin API Auth** - Fixed token decoding in staff.js, analytics.js, and reset-password.js APIs (was using raw token instead of decoding base64)
  - ✅ **BUG FIX: Staff Login** - Updated auth.js to check both admin_users AND admin_staff tables for login/verify
  - ✅ **FEATURE: Grant Free Challenges** - Admin can now grant Starter/Pro/Elite challenges to users from User Management page
  - ✅ Built complete admin panel at `/admin-panel/*`
  - ✅ Added admin authentication system (separate from user auth)
  - ✅ Created user management page with search and details
  - ✅ Created bet management page with edit/settle functionality
  - ✅ Added admin dashboard with platform statistics
  - ✅ Seeded admin account (admin@piks.com)
  - ✅ Added Session Summary Popup that displays on sign out with session stats
  - ✅ Tracks session duration from login to logout
  - ✅ Shows bets placed, wins/losses, pending bets, profit/loss, and challenge info
  - ✅ Redirects to home page after closing summary
  - ✅ **MAJOR: Staff Management System** - Added admin_staff table with roles/permissions, staff management page with full CRUD
  - ✅ **MAJOR: Admin Login Redesign** - Matches site auth page with Piks logo and green-bordered card design
  - ✅ **MAJOR: AdminLayout Update** - Replaced "Piks Admin" text with Piks logo, added Staff and Analytics nav items
  - ✅ **MAJOR: Enhanced User Management** - Clickable rows to expand, multi-select with bulk actions, CSV export, password reset
  - ✅ **MAJOR: Analytics Dashboard** - Shows total events, sessions, page views, demo bets, unplaced bets, events by type, top pages
  - ✅ **MAJOR: User Tracking System** - Complete tracking infrastructure with 6 new database tables (admin_staff, user_events, session_metrics, demo_bets, unplaced_bets, page_views)
  - ✅ **Tracking APIs** - Created /api/analytics/* endpoints for event ingestion (events, page-view, demo-bet, unplaced-bet, session)
  - ✅ **Client Tracking Hook** - useEventTracking.js for easy integration with session heartbeat and batch event sending
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