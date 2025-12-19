# Piks - Sports Betting Challenge Platform

## Overview
Piks is a Next.js sports betting platform offering funded challenges. Users can participate in various challenge tiers, gain access to funded accounts, and retain a percentage of their profits. The platform aims to provide a comprehensive betting experience, from demo trials to real-money challenges, focusing on user progression and profit sharing.

## User Preferences
None documented yet.

## System Architecture

### UI/UX Decisions
- **Design Aesthetic**: Clean, professional, minimal with a black background and glass-morphism card effects.
- **Logo**: Prominent Piks logo, centered on mobile and left-aligned on desktop.
- **Mobile Navigation**: Standard hamburger menu with swipe gestures and body scroll lock.
- **Bet Slip**: Floating bet slip button, full-screen on mobile.
- **Bet Receipt**: Professional bet confirmation display with auto-dismissal.

### Technical Implementations
- **Framework**: Next.js 14.2.30
- **Styling**: Tailwind CSS
- **State Management**: React Context (AuthContext, BetSlipContext, UserProfilesContext)
- **Authentication**: NextAuth.js v4 with email/password (bcrypt) and JWT-based sessions. OAuth providers are disabled but integrated for future use.
- **Database ORM**: Drizzle ORM with `@neondatabase/serverless` HTTP driver.
- **Beta Access**: Password-protected beta landing page with persistence via localStorage.
- **Demo Platform**: Fully functional demo with localStorage persistence for practice betting.
- **Challenge Persistence**: Challenge selections stored in localStorage and database via API.

### Feature Specifications
- **Challenge Tiers**: Starter ($5k funding, $149), Pro ($10k funding, $249), Elite ($25k funding, $399), all with 90% profit split in Reward phase.
- **Challenge Phases & Rules**:
    - **Phase 1 & 2**: 20 picks min, 1-5% risk/pick, 10% max daily loss, 15% max drawdown, 20% profit target. 10% pick cashout fee.
    - **Reward Phase**: Same as above but no profit target, 90% reward split, 5-day inactivity timer.
    - Same-game parlays allowed across all phases.
- **Global Popups**: Challenge, How-It-Works, Demo, Auth, Session Summary popups accessible site-wide.
- **Session Summary Popup**: Displays session duration, bets, wins/losses, pending bets, profit/loss, and challenge info upon sign out.
- **Admin Panel**: Accessible at `/admin-panel/login`, includes dashboard, user management (search, multi-select, CSV export, password reset, activity modal with detailed timeline, bets, and withdrawals), bet management, staff management with roles and granular permissions, and analytics.
- **Withdrawal System**: Comprehensive withdrawal management including payment method-specific forms, history, status flows (Under Review, Awaiting Processing, Finalized/Denied), user cancellation, and admin approval/denial.
- **User Tracking & Analytics**: Tracks all user interactions, session metrics, page views, demo bets, and unplaced bets via dedicated database tables and client-side hooks.

### System Design Choices
- **Authentication Flow**: Beta access -> NextAuth.js -> JWT session -> User profile creation -> Challenge selection & purchase -> Challenge data persistence.
- **Database Schema**: Includes `users`, `profiles`, `user_bets`, `accounts`, `sessions`, `verification_tokens`, `admin_users`, `admin_staff`, `payment_methods`, `withdrawals`, `user_events`, `session_metrics`, `page_views`, `demo_bets`, `unplaced_bets`.
- **API Architecture**: RESTful API routes in `/pages/api/*` for authentication, user profiles, admin functions, analytics, payment methods, and withdrawals.

## External Dependencies
- **Authentication**: NextAuth.js v4
- **Database**: Replit PostgreSQL (Neon-backed) via Drizzle ORM
- **Payment Processing**: Stripe (for environment variables)
- **Sports Data**: Multi-source NBA game data with fallback support
  - **Primary: The Odds API** (active)
    - API service: `lib/theoddsapi.js`
    - Provides: Games, spreads, totals, moneylines from multiple bookmakers
    - Secret: THE_ODDS_API_KEY
    - Pay-as-you-go pricing model
  - **Fallback: Sportsradar NBA API v8**
    - API service: `lib/sportsradar.js`
    - Provides: Games, schedules, scores, full team names, venues, broadcasts
    - Secret: SPORTSRADAR_API_KEY
  - **Fallback: MySportsFeeds API**
    - API service: `lib/mysportsfeeds.js`
    - Secrets: MYSPORTSFEEDS_API_KEY, MYSPORTSFEEDS_PASSWORD
  - Games endpoint: `/api/games/nba`
  - Source override: `/api/games/nba?source=theodds|sportsradar|mysportsfeeds`
  - Debug endpoint: `/debug/api` (bypasses beta access)
  - Server-side caching with 5-minute refresh interval