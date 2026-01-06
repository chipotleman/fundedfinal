# Piks - Sports Betting Challenge Platform

## Overview
Piks is a Next.js sports betting platform that offers funded challenges across various tiers. Its core purpose is to enable users to participate in betting challenges, gain access to funded accounts upon successful completion, and share in the profits. The platform supports a full user journey from demo practice to real-money challenges, emphasizing user progression and a profit-sharing model.

## User Preferences
None documented yet.

## System Architecture

### UI/UX Decisions
The platform features a clean, professional, and minimal design with a black background and glass-morphism card effects. Key UI elements include a prominent Piks logo, mobile-first navigation with a hamburger menu, a floating bet slip button that expands to full screen on mobile, and a professional bet receipt display.

### Technical Implementations
Built with Next.js 14.2.30 and styled using Tailwind CSS. State management is handled by React Context (Auth, BetSlip, UserProfiles, Games, Theme). Authentication uses NextAuth.js v4 with email/password and JWT sessions. Drizzle ORM with `@neondatabase/serverless` interacts with the database. The platform includes a password-protected beta landing page, a functional demo platform with localStorage persistence, and challenge persistence managed via localStorage and database API.

### Feature Specifications
- **Challenge Tiers**: Starter ($5k), Pro ($10k), Elite ($25k) with 90% profit split in Reward phase.
- **Challenge Phases & Rules**: Standardized rules for 20 picks minimum, risk limits (1-5% per pick), max daily loss (10%), max drawdown (15%), and profit targets (20% for Phases 1 & 2). Same-game parlays are allowed.
- **Global Popups**: Centralized popups for Challenges, How-It-Works, Demo, Auth, and Session Summary.
- **Session Summary**: Provides a detailed overview of betting activity and challenge status upon sign out.
- **Admin Panel**: Comprehensive administration at `/admin-panel/login` for user, bet, staff management (with roles and permissions), and analytics.
- **Withdrawal System**: Manages user withdrawals with payment method-specific forms, history tracking, and admin approval workflows.
- **User Tracking & Analytics**: Extensive logging of user interactions, sessions, page views, demo bets, and unplaced bets.
- **Education Marketplace**: Allows "Piks Verified" cappers (users who passed funded challenges) to sell picks and Discord access through subscription products. Includes Discord integration for member management, a review system, performance stats, and a seller dashboard.
- **1v1 Matchmaking System**: A competitive betting system where users challenge each other, with configurable battle durations (30 min to 1 week). Winners take 90% of the combined pot. Features include real-time opponent matching, bet visibility rules (opponent's bets visible only after placing your own), admin-controlled fake opponents, and automated matchup resolution.
- **User Profiles**: Full user profile system with customizable usernames, avatars, bios, and public profile pages displaying battle history and stats.

### System Design Choices
- **Authentication Flow**: Structured from beta access to challenge purchase and data persistence.
- **Database Schema**: Comprehensive schema including tables for users, profiles, bets, accounts, admin, payment, withdrawals, events, metrics, demo bets, unplaced bets, odds history, completed games, cappers, marketplace subscriptions, reviews, Discord integrations, matchups, and ad slots.
- **Ad Slot Management**: Configurable banner carousel ads managed via the admin panel, supporting direct image uploads.
- **Bet Autograding System**: An automated system (AutoGrader) polls for completed games every 60 seconds to grade pending bets, supporting various bet types (moneyline, spread, total, parlays), and updating user bankrolls.
- **API Architecture**: Utilizes RESTful API routes for all core functionalities, including authentication, user management, admin tasks, analytics, and financial operations.

## External Dependencies
- **Authentication**: NextAuth.js v4
- **Database**: Replit PostgreSQL (Neon-backed) via Drizzle ORM
- **Payment Processing**: Stripe (for environment variables)
- **Sports Data**: Goalserve API (primary source)
  - **Goalserve REST API**: Used for fetching games, odds (primarily bet365, with multi-bookmaker comparison in admin), live scores, and play-by-play data. Noteworthy is the critical handling of `hometeam`/`awayteam` reversal in all Goalserve feeds, which is corrected by internal parsers. Caches data for 30 seconds (12s live).
  - **Goalserve WebSocket**: Provides real-time, sub-second live scores and in-play odds. Requires IP whitelisting for production and uses a JWT token for authentication. A development fallback to the REST API is in place.
  - **Goalserve Inplay HTTP Feeds**: Alternative real-time data source with gzipped JSON feeds updating every second. Also requires IP whitelisting and has the same `hometeam`/`awayteam` reversal as the REST API.
  - **The Odds API**: A backup odds API, currently disabled in favor of Goalserve.
  - **Dashboard Data Architecture**: Live and Upcoming tabs on the dashboard use separate data sources (Goalserve Inplay SSE for live, Goalserve REST API for upcoming) to prevent flickering. Games are displayed in "Away @ Home" format.
  - **Games Preloading**: GamesContext preloads game data on app load and connects to SSE for real-time updates.
  - **Caching**: Server-side caching for Goalserve data (30 seconds per sport).
  - **Odds Parsing**: Specific parsing logic for Moneyline, Spreads, and Totals, including nuances for NBA and NHL handicaps.
  - **Admin Odds View**: Provides a full bookmaker comparison spreadsheet and historical odds downloads.