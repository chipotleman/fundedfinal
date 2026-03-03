# Piks - Sports Betting Battle Platform

### Overview
Piks is a Next.js sports betting platform centered on competitive 1v1 betting battles. Users compete against friends or random opponents in real-time betting matchups, with the winner taking 90% of the combined pot (10% platform fee). Features include Quick Match (random matchmaking), Play a Friend (friend invites), Private Match (shareable codes), battle history, and social features. The platform also includes multi-player Pik Pools and an education marketplace.

### User Preferences
- **No purple gradients** — purple signals "vibe coding". Use blue, emerald, cyan, and orange for premium look.
- **No hover effects on mobile/iPad** — use `@media (hover: none)` to disable hover states on touch devices.
- **High-end aesthetic** — should look like a billion-dollar company is behind it. Clean, minimal, professional.
- **"Cancel Friend Request"** not "Withdraw Request" for cancelling sent friend requests.

### System Architecture

#### UI/UX Decisions
- **Design Aesthetic**: Clean, professional, minimal with a black background and glass-morphism card effects, featuring a prominent Piks logo.
- **Mobile Navigation**: Standard hamburger menu with swipe gestures.
- **Bet Slip**: Floating button, full-screen on mobile.
- **Bet Receipt**: Professional display with auto-dismissal.
- **Sticky Navigation**: TopNavbar stays fixed at top (z-50), exposes height via `--top-nav-height` CSS variable.
- **Docking Header**: The combined sticky header that appears when scrolling on the dashboard. Consists of the logo, hamburger menu, and sports filter pills all docking together at the top. This is distinct from the regular TopNavbar - the Docking Header specifically refers to the scrolling behavior where these elements stay visible as the user scrolls down. Uses `position: sticky` with `top: var(--top-nav-height)` (z-40).
- **Unified Sports Filter**: Single row of filter pills with "Live" as the first option (red styling), followed by sport categories. No separate Live/Upcoming tabs - each sport shows all games (live first, then upcoming). Games are always sorted chronologically.

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
- **1v1 Battle System (Trivia Crack-inspired)**: Redesigned Battle Home page at `/battle` with three primary action tiles:
  - **Quick Match**: Random matchmaking with buy-in/duration config via modal. Uses `/api/battles/matchmaking` queue + `/api/matchups/assign-opponent` fallback.
  - **Play a Friend**: Search friends, send battle invite with buy-in/duration. Non-friend users can send friend request or create private match code instead. Uses `/api/battles/invite` CRUD.
  - **Private Match**: Generate 6-char alphanumeric code or join with code. Uses `/api/battles/private` (create/join actions).
  - **Battle Forfeit**: Users can forfeit active battles from any page (battle, my-battle, dashboard). Opponent wins 90% of pot. API: `POST /api/battles/forfeit`.
  - **Live Battles Showcase**: `LiveBattlesSection` component displays active battles as spectator cards with player avatars, balances, PnL, progress bars, and pot size. Visible to everyone (including guests). Polls `/api/battles/live` every 30 seconds. Shown on both `/battle` (full) and dashboard (compact strip). Filters out ended battles (remainingMs <= 0). Falls back to simulated bot battles when no real battles are active. Supports `focusBattleId` prop to highlight a specific battle (from dashboard click-through via `?battle=ID` URL param). `/api/battles/live` filters out expired battles even if still marked `active` in DB.
  - **BattleChat (Twitch-style)**: `components/battle/BattleChat.js` provides live chat on spectator cards. Compact mode shows 1-line chat preview on battle cards; expanded mode shows full scrolling chat with input field, send button, colored usernames, and viewer count. Currently uses simulated messages (foundation for real-time chat). Integrated into `LiveBattlesSection` both compact and expanded views.
  - **Pending Match Polling**: Battle page and My Battle page poll `/api/matchups/current` every 5 seconds when a `waiting` match exists, auto-detecting when opponent joins (waiting → active/matched transition). PrivateMatchModal also polls and shows "Opponent Joined!" animation with auto-redirect.
  - **Private Match Cancel**: PrivateMatchModal shows cancel button in "created" mode, calls `POST /api/battles/private` with `action: 'cancel'`. Also shows hint that match stays active on Battle/My Battle pages if modal is closed.
  - **Auto-Resolve**: `/api/matchups/current` now detects expired-but-active battles and triggers async resolution via `/api/matchups/resolve`. `/api/matchups/resolve` fixed to use `startsAt` (not `startedAt`).
  - Battle Home layout: User identity strip, 3 large action tiles, live battles showcase, incoming invite toasts, friends sidebar (desktop) / drawer (mobile), recent matches list.
  - Match lifecycle: Battle Home → Modal config → Matchmaking/Invite → Match Lobby (5s countdown) → Dashboard (place bets) → Match Result overlay.
  - Components in `components/battle/`: QuickMatchModal, PlayFriendModal, PrivateMatchModal, InviteToast, MatchHistoryModal, MatchLobby, MatchResult, LiveBattlesSection, BattleChat, ForfeitModal.
  - Schema additions: `privateCode` and `matchType` columns on `matchups` table.
  - Winner takes 90% of combined pot (10% platform fee). Hidden opponent bets until user places their own. Admin-controlled fake opponents.
  - **Gamified Battle Experience** (CSS-only animations, no sound):
    - **MatchLobby**: Fighting-game entrance — avatars slide in from left/right, "VS" slam animation, glowing avatar rings, countdown numbers scale+fade per tick, "BATTLE!" flash at 0 with screen flash before redirect.
    - **MatchResult**: Win = confetti rain (40 CSS particles) + trophy bounce + "VICTORY!" golden glow + prize counter-up animation. Loss = screen shake + red vignette + "DEFEAT" fade-in. Tie = scale emoji + cyan. All stats count up from 0 with eased animation. "Share Win" copies to clipboard. Rematch button pulses.
    - **QuickMatchModal search**: Radar sweep animation, cycling opponent avatars (fetched from `/api/admin/battle-avatars`) with 3D flip transition, random names/records flashing, dramatic "MATCHED!" reveal with green flash + expanding ring.
    - **ForfeitModal**: Custom red-themed confirmation modal (replaces window.confirm). Shows "Surrender?" with consequences, "Keep Fighting" (green) vs "Forfeit Battle" (red pulsing) buttons, loading spinner state.
    - **Spectator reactions**: Expanded battle cards have reaction buttons (Fire/Money/Intense/Eyes) with floating emoji animations. Momentum flame icon on players with PnL > 10%. Shimmer on leading player's progress bar. Slide-in transition on compact chat messages.
  - **Cross-page integration**: Dashboard shows MatchupBanner with forfeit option, My Battle page (`/my-battle`) uses `/api/battles/history` for robust history with match type labels, links to `/battle` when no active matchup.
- **Friend Request Withdrawal**: Users can withdraw sent friend requests from both the friends page (Requests tab → Sent section) and profile pages. API: `PATCH /api/friends/[id]` with `action: 'withdraw'`.
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
    - **Zero-Delay SSR Architecture**: Both live AND scheduled games render instantly via Server-Side Rendering:
      1. Server starts → `instrumentation.js` triggers 24/7 polling via `goalserve-autostart.js`
      2. Two caches warm in parallel: inplay cache (live games) and schedule cache (upcoming games via REST API)
      3. Dashboard `getServerSideProps` calls `waitForCache()` + `waitForScheduleCache()` then merges both
      4. Trimmed game events (live + scheduled) embedded directly in HTML response
      5. `GamesProvider` initializes with SSR data via `initialApiGames` prop, skips client-side fetch if data exists
      6. Dashboard derives games via `useMemo` at render time (not useEffect) for SSR compatibility
      7. SSE connects after hydration for live updates only
      8. Key files: `lib/goalserve-autostart.js`, `lib/goalserve-inplay.js`, `lib/schedule-cache.js`, `instrumentation.js`, `contexts/GamesContext.js`
      9. Cold start behavior: First request after server restart takes ~16-20s (Goalserve API latency); subsequent requests are instant (~3s)
      10. Production note: Long-running servers maintain warm caches, so all user requests are instant after initial startup
    - **Dashboard Data Architecture**: Live tab uses Inplay SSE, Upcoming tab uses REST API, with no merging to prevent flickering.
    - **Odds Parsing**: Supports Moneyline, Spreads, Totals for various sports.
    - **Admin Odds View**: Full bookmaker comparison in admin panel.
    - **Historical Odds**: Downloadable historical odds pulls.
    - **Real-Time Possession Polling**: 
      1. `LivePossessionPoller` service polls Goalserve REST API every 5 seconds for live games only
      2. Extracts possession boolean (which team has the ball) from team data
      3. Detects and broadcasts possession/score changes via dedicated SSE endpoint (`/api/goalserve/possession-stream`)
      4. Auto-starts when first subscriber connects, auto-stops when no subscribers remain
      5. Prunes finished games from state to prevent memory leaks
      6. GamesContext integrates `possessionState` and `getPossession(gameId)` helper
      7. Key files: `lib/live-possession-poller.js`, `pages/api/goalserve/possession-stream.js`, `contexts/GamesContext.js`
- **Backup Sports Data**: The Odds API (not currently used).