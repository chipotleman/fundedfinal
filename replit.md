# Piks - Sports Betting Challenge Platform

### Overview
Piks is a Next.js sports betting platform that offers funded challenges across various tiers (Starter, Pro, Elite). It allows users to progress from demo trials to real-money challenges, gain access to funded accounts, and retain a percentage of their profits. The platform emphasizes user progression, profit sharing, and a comprehensive betting experience. Key features include competitive 1v1 matchmaking, multi-player Pik Pools, and an education marketplace where verified cappers can sell picks.

### User Preferences
None documented yet.

### System Architecture

#### UI/UX Decisions
- **Design Aesthetic**: Clean, professional, minimal with a black background and glass-morphism card effects, featuring a prominent Piks logo.
- **Mobile Navigation**: Standard hamburger menu with swipe gestures.
- **Bet Slip**: Floating button, full-screen on mobile.
- **Bet Receipt**: Professional display with auto-dismissal.

#### Technical Implementations
- **Framework**: Next.js 14.2.30
- **Styling**: Tailwind CSS
- **State Management**: React Context (Auth, BetSlip, UserProfiles, Games, Theme)
- **Authentication**: NextAuth.js v4 (email/password with bcrypt, JWT sessions).
- **Database ORM**: Drizzle ORM with `@neondatabase/serverless` HTTP driver.
- **Persistence**: localStorage for beta access, demo platform, and challenge selections.

#### Feature Specifications
- **Challenge Tiers**: Starter ($5k funding, $149), Pro ($10k funding, $249), Elite ($25k funding, $399), all with 90% profit split in Reward phase.
- **Challenge Rules**: 20 picks min, 1-5% risk/pick, 10% max daily loss, 15% max drawdown, 20% profit target (Phase 1 & 2). 10% pick cashout fee. Same-game parlays allowed.
- **Global Popups**: Challenge, How-It-Works, Demo, Auth, Session Summary.
- **Session Summary**: Displays session stats upon sign out.
- **Admin Panel**: Dashboard, user/bet/staff management with roles/permissions, analytics, withdrawal management. Includes bulk mock user generator (paste avatar URLs to create fake accounts) and PATCH cleanup endpoint for data integrity.
- **Withdrawal System**: Payment method-specific forms, history, status flows, user cancellation, admin approval.
- **User Tracking & Analytics**: Tracks user interactions, session metrics, page views, demo bets, unplaced bets.
- **Education Marketplace**: Verified cappers sell picks and Discord access via subscription products; includes review system and performance stats.
- **1v1 Matchmaking System**: Users compete head-to-head for a prize pot (winner takes 90% of combined pot). Configurable durations, hidden opponent bets until user places their own, admin-controlled fake opponents. Opponent avatars cycle every 0.6s from admin-uploaded images (fallback to animal emojis). Fake opponents must have valid entries in users, profiles, AND fakeOpponents tables with matching IDs.
- **User Profiles**: Customizable profiles with username (2-100 chars), avatar (upload or URL), bio (max 500 chars), battle stats, and public profile pages. Avatar uploads use Replit Object Storage with presigned URLs.
- **Pik Pool System**: Multi-player betting competitions (5-25 players) for a prize pool (winner takes 90%). Configurable buy-ins and durations.

#### System Design Choices
- **Authentication Flow**: Beta access -> NextAuth.js -> JWT session -> User profile -> Challenge selection/purchase -> Data persistence.
- **Database Schema**: Comprehensive schema including users, profiles, bets, challenges, admin, withdrawals, analytics, cappers, matchups, and pik pools.
- **Bet Autograding System**: AutoGrader polls `/api/bets/grade` every 60 seconds, matches pending bets to completed games, supports various bet types (moneyline, spreads, totals, parlays), and updates user bankroll.
- **API Architecture**: RESTful API routes for core functionalities.
- **Context-Specific Balance System**: Users can only be in ONE active challenge at a time (either 1v1 or pool, not both). Balance displayed reflects the active challenge:
  - **No active challenge**: Uses profile.bankroll
  - **Active 1v1**: Uses matchup.user1Balance or user2Balance (depending on which user they are)
  - **Active Pool**: Uses poolParticipants.balance
  - Pool statuses `open`, `filling`, and `active` all count as "active" for mutual exclusivity checks.
  - Bets placed during a challenge only affect that challenge's balance and are stored in the appropriate table (poolBets for pools, userBets for regular/1v1).
  - API: `/api/user/active-challenge` returns user's current challenge context and balance.

### External Dependencies
- **Authentication**: NextAuth.js v4
- **Database**: Replit PostgreSQL (Neon-backed) via Drizzle ORM
- **Payment Processing**: Stripe (environment variables)
- **Sports Data**: Goalserve API (primary source)
    - **Goalserve REST API**: Main data source for games and odds (bet365 primary), with 30-second caching. Handles home/away team reversal internally.
    - **Goalserve WebSocket**: Real-time scores and in-play odds, IP whitelisted for production. Development uses REST API fallback.
    - **Goalserve Inplay HTTP Feeds**: Alternative real-time data, also requires IP whitelisting and handles home/away reversal.
    - **Supported Sports**: NBA, NFL, NCAAB, NCAAF, MLB, NHL, Soccer, Euro Basketball, Int'l Hockey.
    - **Zero-Delay SSR Architecture**: Live games render instantly (same moment as logo) via Server-Side Rendering:
      1. Server starts → `instrumentation.js` triggers 24/7 polling via `goalserve-autostart.js`
      2. Cache warms with live game data from Goalserve inplay feeds
      3. Dashboard has `getServerSideProps` that calls `waitForCache()` then `getEventsForSSR()`
      4. Trimmed game events embedded directly in HTML response
      5. `GamesProvider` initializes with SSR data, skips client-side fetch if data exists
      6. Dashboard derives games via `useMemo` at render time (not useEffect) for SSR compatibility
      7. SSE connects after hydration for live updates only
      8. Key files: `lib/goalserve-autostart.js`, `lib/goalserve-inplay.js`, `instrumentation.js`, `contexts/GamesContext.js`
    - **Dashboard Data Architecture**: Live tab uses Inplay SSE, Upcoming tab uses REST API, with no merging to prevent flickering.
    - **NFL Live Odds Workaround**: NFL odds use schedule endpoint polling (30s interval) with `showodds=1` and today's date, bypassing IP-restricted inplay feeds. Implemented in `fetchNFLScheduleOdds()` in `lib/goalserve-inplay.js`.
    - **Odds Parsing**: Supports Moneyline, Spreads, Totals for various sports.
    - **Admin Odds View**: Full bookmaker comparison in admin panel.
    - **Historical Odds**: Downloadable historical odds pulls.
- **Backup Sports Data**: The Odds API (not currently used).