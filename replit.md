# Piks - Sports Betting Battle Platform

### Overview
Piks is a Next.js sports betting platform designed for competitive 1v1 betting battles. It enables users to compete against friends or random opponents in real-time betting matchups, with the winner keeping the entire pot (Piks takes a 5% rake). Key features include Quick Match, Play a Friend, Private Match, battle history, and social functionalities. The platform also offers multi-player Pik Pools and an education marketplace. The business vision is to provide a high-end, engaging, and competitive sports betting experience.

### User Preferences
- No purple gradients — purple signals "vibe coding". Use blue, emerald, cyan, and orange for premium look.
- No hover effects on mobile/iPad — use `@media (hover: none)` to disable hover states on touch devices.
- High-end aesthetic — should look like a billion-dollar company is behind it. Clean, minimal, professional.
- "Cancel Friend Request" not "Withdraw Request" for cancelling sent friend requests.

### System Architecture

#### UI/UX Decisions
The platform features a clean, professional, and minimal design with a black background and glass-morphism card effects, highlighting a prominent Piks logo. Mobile navigation utilizes a standard hamburger menu with swipe gestures, and the bet slip appears as a floating button, expanding to full-screen on mobile. Key navigation elements like the TopNavbar are sticky, and a "Docking Header" provides a combined sticky header experience on the dashboard. A unified sports filter uses a single row of pills, with "Live" prominently displayed, and games are always sorted chronologically.

#### Technical Implementations
The platform is built on Next.js 14.2.30, utilizing Tailwind CSS for styling. State management is handled through React Context. Authentication is managed by NextAuth.js v4, supporting email/password and JWT sessions. Drizzle ORM with `@neondatabase/serverless` is used for database interactions. LocalStorage is employed for persistence of beta access, demo platform, and challenge selections.

#### Feature Specifications
Piks offers various Challenge Tiers (Starter, Pro, Elite) with specific funding levels, profit splits, and rules, including minimum picks, risk percentages, max daily loss, max drawdown, and profit targets. The platform includes global popups for challenges, how-it-works, demo, authentication, and session summaries. An Admin Panel provides comprehensive management tools for users, bets, staff, analytics, and withdrawals, including a bulk mock user generator and data cleanup endpoints. A robust Withdrawal System supports various payment methods and status flows. User tracking and analytics monitor interactions, session metrics, and bet activities. The Education Marketplace allows verified cappers to sell picks and Discord access via subscriptions, complete with reviews and performance stats.

The 1v1 Battle System, inspired by Trivia Crack, features a redesigned Battle Home page with Quick Match for random matchmaking, Play a Friend for inviting friends, and Private Match for code-based battles. Battles use a Game Mode system instead of free-form duration: **RUSH** (10,000 coins, pick 6 props from a live game), **ORIGINAL** (10,000 coins, full day of games, highest balance wins), and **TOURNAMENT** (100,000 coins, 3-day battle). Game modes are stored as `game_mode` in `battle_invites` and `matchmaking_queue` tables, and map to `durationType` in `matchups`. Users can forfeit active battles, and a Live Battles Showcase displays active battles to spectators, including player avatars, balances, and PnL, with real-time chat functionality. Gamified battle experiences include fighting-game-style animations for MatchLobby, MatchResult (confetti for wins, screen shake for losses), and QuickMatchModal search. A gamified VS hero card on the battle page shows real-time player vs opponent avatars, balances, PnL, domination bar, and time remaining. Cross-page integration ensures consistent battle information across the dashboard and dedicated battle pages. Users can withdraw sent friend requests from designated sections. Customizable User Profiles support usernames, avatars, bios, and battle statistics, with avatar uploads leveraging Replit Object Storage. The Pik Pool System facilitates multi-player betting competitions for a prize pool.

#### System Design Choices
The authentication flow progresses from beta access through NextAuth.js, JWT sessions, user profiling, and challenge selection. A comprehensive Database Schema supports users, profiles, bets, challenges, and other core functionalities. A Bet Autograding System automatically grades pending bets against completed games, supporting various bet types and updating user bankrolls. The API architecture is RESTful. A context-specific balance system ensures that user balances accurately reflect their active challenge (1v1 battle or Pik Pool), with mutual exclusivity enforced for active challenges.

### External Dependencies
- **Authentication**: NextAuth.js v4
- **Database**: Replit PostgreSQL (Neon-backed) via Drizzle ORM
- **Payment Processing**: Stripe
- **Sports Data**: Goalserve API (primary source)
    - **Goalserve REST API**: Main data source for games and odds with caching.
    - **Goalserve WebSocket**: Real-time scores and in-play odds (IP whitelisted).
    - **Goalserve Inplay HTTP Feeds**: Alternative real-time data.
    - **Supported Sports**: NBA, NFL, NCAAB, NCAAF, MLB, NHL, Soccer, Euro Basketball, Int'l Hockey.
    - **Zero-Delay SSR Architecture**: Ensures instant rendering of live and scheduled games via server-side rendering and continuous cache warming.
    - **Real-Time Possession Polling**: A dedicated service polls for possession changes and broadcasts them via SSE.
- **Simulated Games Fallback**: `lib/simulated-games.js` generates realistic demo games when the Goalserve API is unavailable or returns no data.