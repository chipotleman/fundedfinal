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
- **Education Marketplace**: Verified cappers (users who passed funded challenges) can sell picks and Discord access:
    - **Capper Registration**: Users who complete challenges become "Piks Verified" and can register as sellers
    - **Products/Passes**: Cappers create subscription products (daily, weekly, monthly, lifetime) with custom pricing
    - **Subscriptions**: Buyers purchase passes to access picks and Discord communities
    - **Discord Integration**: Auto add/remove members when subscriptions start/expire
    - **Review System**: Buyers can rate and review cappers they've subscribed to
    - **Performance Stats**: Win rate, ROI, and record computed from graded bets
    - **Seller Dashboard**: Revenue tracking, subscriber management, product creation
    - **Admin Management**: Marketplace section in admin panel for managing cappers, subscriptions, and moderating reviews

### System Design Choices
- **Authentication Flow**: Beta access -> NextAuth.js -> JWT session -> User profile creation -> Challenge selection & purchase -> Challenge data persistence.
- **Database Schema**: Includes `users`, `profiles`, `user_bets`, `accounts`, `sessions`, `verification_tokens`, `admin_users`, `admin_staff`, `payment_methods`, `withdrawals`, `user_events`, `session_metrics`, `page_views`, `demo_bets`, `unplaced_bets`, `odds_history_pulls`, `completed_games`, `cappers`, `capper_products`, `capper_subscriptions`, `capper_reviews`, `discord_links`, `capper_performance`, `discord_jobs`.
- **Bet Autograding System**:
  - AutoGrader component in `_app.js` polls `/api/bets/grade` every 60 seconds when users are active
  - Completed games are saved to `completed_games` table to preserve results after they disappear from the API
  - Grading logic matches pending bets to completed games by matchup name (e.g., "Team A @ Team B")
  - Supports single bets, spreads, totals, moneylines, and parlays
  - Automatically updates user bankroll on win/push
  - Grading endpoint: `/api/bets/grade` (POST)
- **API Architecture**: RESTful API routes in `/pages/api/*` for authentication, user profiles, admin functions, analytics, payment methods, and withdrawals.
- **Dashboard State Persistence**: Games data protected from transient empty API responses using API signals:
  - `fromCache` and `freshness.hasLiveGames` distinguish legitimate empty responses from transient issues
  - Stale cached empty responses are skipped; fresh responses or explicit "no games" signals allow state clearing
  - Prevents data loss during popup navigation or SSE reconnections

## External Dependencies
- **Authentication**: NextAuth.js v4
- **Database**: Replit PostgreSQL (Neon-backed) via Drizzle ORM
- **Payment Processing**: Stripe (for environment variables)
- **Sports Data**: Goalserve API (primary source for all data)
  - **Goalserve REST API** (primary - powers main dashboard)
    - API service: `lib/goalserve.js`
    - Secret: GOALSERVE_API_KEY
    - Main endpoint: `/api/games` - Fetches all games with bet365 odds
    - Primary bookmaker: bet365 (with multi-bookmaker comparison in admin panel)
    - Features: Live scores, play-by-play with court position, odds from 10+ bookmakers
    - **CRITICAL: Home/Away REVERSED in ALL Goalserve feeds**: Both REST API and Inplay feeds have `hometeam`/`awayteam` REVERSED. Both parsers swap them:
      - `lib/goalserve.js` swaps REST API data (Goalserve hometeam → our awayTeam)
      - `lib/goalserve-inplay.js` swaps Inplay data (Goalserve home → our awayTeam)
      - This ensures games display correctly as "Away @ Home" (away team first/top, home team second/bottom)
    - Additional endpoints:
      - `/api/goalserve/games` - Direct Goalserve games endpoint
      - `/api/goalserve/odds?sport=basketball_nba` - Odds only
      - `/api/goalserve/playbyplay?sport=basketball_nba` - Live play-by-play with X/Y court positions
      - `/api/goalserve/live` - All live games across sports
    - Supported sports: basketball_nba, americanfootball_nfl, basketball_ncaab, americanfootball_ncaaf, baseball_mlb, icehockey_nhl
    - Caching: 30-second cache (12s during live games)
    - Pricing: Subscription-based (unlimited requests)
  - **Goalserve WebSocket** (real-time feeds - IP whitelisted for production only)
    - Service: `lib/goalserve-ws.js`
    - Features: Sub-second live scores, in-play odds from bet365, ball position tracking
    - Authentication: JWT token flow via `http://live.goalserve.com/api/v1/auth/gettoken`
    - WebSocket URL: `ws://live.goalserve.com/ws/{sport}?tkn={jwt_token}`
    - **IP Whitelisting**: Goalserve whitelisted 2 static deployment IPs only (not development). WebSocket will fail locally but work in production deployment.
    - **Development Fallback**: REST API polling (30-second cache) is used automatically in development
    - Message types: `avl` (available events list), `updt` (real-time score/odds updates)
    - **WebSocket Sport Identifiers** (must use exact names):
      - `soccer` - Soccer/Football
      - `basket` - Basketball (NBA, NCAAB, Euro)
      - `amfootball` - American Football (NFL, NCAAF)
      - `hockey` - Ice Hockey (NHL)
      - `baseball` - Baseball (MLB)
      - `tennis` - Tennis
      - `volleyball` - Volleyball
    - Sport mapping in `lib/goalserve-ws.js` converts internal names to WebSocket identifiers
    - Endpoints:
      - `/api/goalserve/stream` - Server-Sent Events (SSE) for real-time updates from WebSocket
      - `/api/goalserve/ws-status` - WebSocket connection status (use `?connect=true` to attempt connection)
      - `/api/goalserve/ws-live` - Get current live events from WebSocket data store
    - Client hooks in `hooks/useGoalserveLive.js`:
      - `useGoalserveLive({ sport, eventId, autoConnect })` - Main hook for live data
      - `useLiveEvent(eventId)` - Hook for specific event updates
      - `useLiveSport(sport)` - Hook for sport-specific updates
    - Fallback: If WebSocket unavailable, use REST API polling via `/api/goalserve/live` (30-second cache)
  - **Goalserve Inplay HTTP Feeds** (alternative real-time data - requires IP whitelisting)
    - **Home/Away Convention**: Same as REST API - Goalserve inplay feed ALSO has home/away REVERSED. The parser in `lib/goalserve-inplay.js` swaps them to match the REST API convention.
    - Service: `lib/goalserve-inplay.js`
    - Features: Gzipped JSON feeds updating every second with live scores and odds
    - Endpoints provided by Goalserve:
      - `http://inplay.goalserve.com/inplay-basket.gz` (basketball)
      - `http://inplay.goalserve.com/inplay-hockey.gz` (hockey)
      - `http://inplay.goalserve.com/inplay-amfootball.gz` (football)
      - `http://inplay.goalserve.com/inplay-baseball.gz` (baseball)
      - `http://inplay.goalserve.com/inplay-soccer.gz` (soccer)
    - API endpoints:
      - `/api/goalserve/inplay?action=status` - Get polling status
      - `/api/goalserve/inplay?action=fetch&sport=basketball` - Fetch single feed
      - `/api/goalserve/inplay?live=true` - Get live events
      - `/api/goalserve/test-access` - Diagnostic endpoint to verify IP whitelisting
    - **IP Whitelisting Required**: Both production IPs must be whitelisted: 52.70.127.138 AND 54.92.239.253
  - **The Odds API** (backup - not currently used)
    - API service: `lib/theoddsapi.js`
    - Provides: US bookmaker odds (FanDuel, DraftKings, BetMGM)
    - Secret: THE_ODDS_API_KEY
    - Pay-as-you-go pricing model
    - Note: Available but disabled in favor of Goalserve
  - **Supported Sports**: NBA, NFL, NCAAB, NCAAF, MLB, NHL, Euro Basketball (via inplay), Int'l Hockey (via inplay)
  - **International Sports Display**: Dashboard merges inplay events (Euro basketball, international hockey) with US sports. Inplay games appear in "Live" tab with real-time score updates via SSE stream.
  - **Game Display Tabs**: Live vs Upcoming tabs on all game pages
  - **Caching**: 30-second server-side cache per sport (Goalserve), 10-minute (The Odds API)
  - **Odds Parsing**: 
    - Moneyline: Home/Away type (id:2) 
    - Spreads: Handicap type (id:4) for basketball, Puck Line (id:23679) for NHL
    - Totals: Total type (id:5) with Over/Under
    - NBA handicap structure: `bm.handicap[].odd` is an array of 2 odds objects (home/away)
    - NHL handicap structure: `bm.handicap[].odd` is a single object per line
  - **Admin Odds View**: Full bookmaker comparison spreadsheet available in admin panel at /admin-panel/games
  - **Historical Odds Downloads**: Save current odds pulls to database and download any historical pull as Excel spreadsheet via `/api/admin-panel/odds-history`