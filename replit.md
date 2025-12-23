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
- **Database Schema**: Includes `users`, `profiles`, `user_bets`, `accounts`, `sessions`, `verification_tokens`, `admin_users`, `admin_staff`, `payment_methods`, `withdrawals`, `user_events`, `session_metrics`, `page_views`, `demo_bets`, `unplaced_bets`, `odds_history_pulls`, `completed_games`.
- **Bet Autograding System**:
  - AutoGrader component in `_app.js` polls `/api/bets/grade` every 60 seconds when users are active
  - Completed games are saved to `completed_games` table to preserve results after they disappear from the API
  - Grading logic matches pending bets to completed games by matchup name (e.g., "Team A @ Team B")
  - Supports single bets, spreads, totals, moneylines, and parlays
  - Automatically updates user bankroll on win/push
  - Grading endpoint: `/api/bets/grade` (POST)
- **API Architecture**: RESTful API routes in `/pages/api/*` for authentication, user profiles, admin functions, analytics, payment methods, and withdrawals.

## External Dependencies
- **Authentication**: NextAuth.js v4
- **Database**: Replit PostgreSQL (Neon-backed) via Drizzle ORM
- **Payment Processing**: Stripe (for environment variables)
- **Sports Data**: Multi-source sports data
  - **Goalserve** (primary source - added Dec 2025)
    - API service: `lib/goalserve.js`
    - Secret: GOALSERVE_API_KEY
    - Features: Live scores, play-by-play with court position, odds from 10+ bookmakers, rosters, injuries, stats
    - Endpoints:
      - `/api/goalserve/games` - All games with scores
      - `/api/goalserve/games?sport=basketball_nba` - Specific sport
      - `/api/goalserve/games?sport=basketball_nba&withOdds=true` - With odds
      - `/api/goalserve/odds?sport=basketball_nba` - Odds only
      - `/api/goalserve/playbyplay?sport=basketball_nba` - Live play-by-play with X/Y court positions
      - `/api/goalserve/playbyplay?sport=basketball_nba&gameId=123` - Specific game
      - `/api/goalserve/playbyplay?sport=basketball_nba&date=2025-12-22` - Historical play-by-play
      - `/api/goalserve/live` - All live games across sports
      - `/api/goalserve/live?withPlayByPlay=true` - Live games with play-by-play
    - Supported sports: basketball_nba, americanfootball_nfl, basketball_ncaab, americanfootball_ncaaf, baseball_mlb, icehockey_nhl
    - Caching: 30-second cache for live data
    - Play-by-play includes: time, period, description, scoring info, player IDs, X/Y court coordinates
  - **The Odds API** (legacy/backup)
    - API service: `lib/theoddsapi.js`
    - Provides: Games, spreads, totals, moneylines from multiple bookmakers
    - Secret: THE_ODDS_API_KEY
    - Pay-as-you-go pricing model
  - **Supported Sports**: NBA, NFL, NCAAB, NCAAF, MLB, NHL
  - **Game Display Tabs**: Live vs Upcoming tabs on all game pages
  - **Caching**: 30-second server-side cache per sport (Goalserve), 10-minute (The Odds API)
  - **Admin Odds View**: Full bookmaker comparison spreadsheet available in admin panel at /admin-panel/games
  - **Historical Odds Downloads**: Save current odds pulls to database and download any historical pull as Excel spreadsheet via `/api/admin-panel/odds-history`