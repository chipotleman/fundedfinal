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
- **Authentication**: Supabase Auth (email/password, OAuth with Apple, Google, Facebook), with PKCE flow and session persistence (`persistSession: true`, `autoRefreshToken: true`). "Remember Me" functionality saves user emails locally.
- **Beta Access**: Password-protected beta landing page with access persistence via localStorage.
- **Demo Platform**: Fully functional demo experience with localStorage persistence, allowing users to customize challenge tiers and practice betting without authentication.
- **Challenge Persistence**: Challenge selections and customizations are stored in localStorage post-payment and loaded automatically during authentication, then saved to Supabase.

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
- **Authentication Flow**: Beta access -> Supabase Auth (email/password or OAuth) -> Session persistence -> User profile creation -> Challenge selection & purchase -> Challenge data persistence.
- **Database Schema**: `profiles` (user data), `user_challenges` (challenge progress), and other marketplace/betting-related tables.

## External Dependencies
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Payment Processing**: Stripe (environment variables for keys)