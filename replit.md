# Piks - Sports Betting Battle Platform

### Overview
Piks is a Next.js sports betting platform enabling competitive 1v1 betting battles. Users can engage in real-time matchups against friends or random opponents, with the winner taking the pot (minus a 5% rake). The platform aims to provide a high-end, engaging, and competitive sports betting experience, featuring Quick Match, Play a Friend, Private Match, battle history, social functions, multi-player Pik Pools, and an education marketplace.

### User Preferences
- No purple gradients — purple signals "vibe coding". Use blue, emerald, cyan, and orange for premium look.
- No hover effects on mobile/iPad — use `@media (hover: none)` to disable hover states on touch devices.
- High-end aesthetic — should look like a billion-dollar company is behind it. Clean, minimal, professional.
- "Cancel Friend Request" not "Withdraw Request" for cancelling sent friend requests.
- Navigation labels: `/dashboard` is labeled **"Battle"** (the place to start a battle, formerly "The Lab"); `/battle` is labeled **"Social"** (a feed/social view of live battles, no longer the entry point for starting a battle). Routes are unchanged — only labels.

### System Architecture

#### UI/UX Decisions
The platform employs a clean, professional, and minimal design with a black background, glass-morphism card effects, and a prominent Piks logo. Mobile navigation uses a hamburger menu with swipe gestures, and the bet slip is a floating button that expands to full-screen on mobile. Sticky elements include the TopNavbar and a "Docking Header" on the dashboard. A unified sports filter uses a single row of pills, with "Live" prominently displayed, and games are sorted chronologically.

#### Technical Implementations
Built on Next.js 14.2.30 with Tailwind CSS, the platform uses React Context for state management and NextAuth.js v4 for authentication (email/password and JWT sessions). Drizzle ORM with `@neondatabase/serverless` handles database interactions. LocalStorage persists beta access, demo platform, and challenge selections.

#### Feature Specifications
Piks offers Challenge Tiers (Starter, Pro, Elite) with specific funding, profit splits, and rules (min picks, risk %, max daily loss/drawdown, profit targets). Global popups are used for challenges, demo, authentication, and session summaries. An Admin Panel provides comprehensive management of users, bets, staff, analytics, and withdrawals, including bulk mock user generation and data cleanup. A robust Withdrawal System supports various payment methods. User tracking and analytics monitor interactions and bet activities. The Education Marketplace allows verified cappers to sell picks and Discord access via subscriptions, with reviews and performance stats.

The 1v1 Battle System, inspired by Trivia Crack, includes Quick Match, Play a Friend, and Private Match. Battle Game Modes are **RUSH** (10,000 coins, 6 props from a chosen live game — both players vote on a live game, host wins ties, then race through 6 auto-generated questions on a server-authoritative 15s-per-question timer; most-correct wins, tiebreak by fastest cumulative answer time; gameplay lives at `/battle/rush/[id]` and rush state is persisted as JSONB on the matchup row), **ORIGINAL** (10,000 coins, full day games, highest balance wins), and **TOURNAMENT** (100,000 coins, 3-day battle). Users can forfeit battles. A Live Battles Showcase displays active battles to spectators with real-time chat. Gamified elements include fighting-game-style animations for MatchLobby, MatchResult, and QuickMatchModal, and a gamified VS hero card showing real-time player data. Users can withdraw sent friend requests. Customizable User Profiles support usernames, avatars, bios, and battle stats, with avatar uploads leveraging Replit Object Storage. The Pik Pool System facilitates multi-player betting competitions.

#### System Design Choices
The authentication flow covers beta access, NextAuth.js, JWT sessions, user profiling, and challenge selection. A comprehensive Database Schema supports core functionalities. A Bet Autograding System automatically grades pending bets and updates bankrolls. The API architecture is RESTful. A context-specific balance system ensures accurate user balances tied to active challenges (1v1 or Pik Pool), enforcing mutual exclusivity. Promo slot tracking and item share tracking are implemented for analytics, respecting user opt-out preferences. Server-side checks enforce analytics opt-out. Top-nav click-trap defenses address iOS Safari navigation issues by ensuring modals fully unmount or are properly managed.

### External Dependencies
- **Authentication**: NextAuth.js v4
- **Database**: Replit PostgreSQL (Neon-backed) via Drizzle ORM
- **Payment Processing**: Stripe
- **Sports Data**: Goalserve API (primary source)
    - **Goalserve REST API**: Main data source for games and odds with caching.
    - **Goalserve WebSocket**: Real-time scores and in-play odds.
    - **Goalserve Inplay HTTP Feeds**: Alternative real-time data.
    - **Supported Sports**: NBA, NFL, NCAAB, NCAAF, MLB, NHL, Soccer, Euro Basketball, Int'l Hockey.
    - **Zero-Delay SSR Architecture**: Instant rendering of live and scheduled games via SSR and continuous cache warming.
    - **Real-Time Possession Polling**: Dedicated service polls and broadcasts possession changes via SSE.
- **Simulated Games Fallback**: `lib/simulated-games.js` generates demo games when Goalserve data is unavailable.