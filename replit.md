# Piks - Sports Betting Challenge Platform

## Overview
Piks is a Next.js-based sports betting platform that provides users with funded challenges to bet with. Users can sign up for different challenge tiers, receive funded accounts, and keep a percentage of their profits.

## Current State
- **Framework**: Next.js 14.2.30
- **Authentication**: Supabase Auth (configured with email/password login)
- **Database**: Supabase PostgreSQL
- **Styling**: Tailwind CSS
- **State Management**: React Context (AuthContext, BetSlipContext, UserProfilesContext)
- **Access Control**: Password-protected beta landing page

## Recent Changes (November 5, 2025)
### Password-Protected Beta Landing Page
- **Created BetaLanding component** that wraps entire site with password protection
  - Beautiful landing page with Piks logo in header (matches TopNavbar exactly: `/funderlogo/Piks.png?v=5`, 90px mobile/115px desktop)
  - Logo positioned in header so it stays in exact same spot when user logs in - no movement/jump
  - Password protection: `baldwin` or `mbarlow99` (stored in component, can be moved to environment variable)
  - **Terms agreement checkbox** with disabled button state:
    - Button is disabled (grayed out) until BOTH conditions are met:
      - User has entered an access code
      - User has checked the terms agreement checkbox
    - Button turns orange gradient when enabled (both conditions met)
    - Clickable Terms of Service and Privacy Policy links that open modal dialogs
    - Full readable terms and privacy policy content in modals
    - Clear visual feedback for enabled/disabled states
  - Beta access signup form for waitlist
  - Signups stored in localStorage (can be migrated to database later)
  - Access persists via localStorage - users don't need to re-enter password
  - Black background for minimal, professional aesthetic
  - Clean, simple access code input box with subtle border
  - "Don't have access?" text properly separated from divider line
  - Integrated into _app.js to gate all site content
  - Clean, professional design with glass-morphism card effects
  - Mobile status bar color matches black background (#000000)

### Authentication Migration: Phone to Email
- **Migrated authentication from phone numbers to email addresses**:
  - Updated auth.js form labels and inputs
  - Changed Supabase auth calls from phone-based to email-based
  - Updated error messages and confirmation text
  - Users now sign up and sign in with email + password
  - Email verification instead of SMS verification
### Mobile Menu Improvements
- Changed menu icon from hamburger to plus sign (+)
- Plus sign disappears when menu opens - only one icon visible at a time (plus or X)
- Removed box/border styling around icon - clean minimal plus icon only
- X button is positioned in menu drawer at exact same height as plus sign (22.5px from top)
- X button is 10% larger than plus sign (31px vs 28px) for easier tapping
- User taps same spot to open (plus) and close (X in drawer) - optimized for mobile UX
- Added swipe gestures: swipe left to open menu, swipe right to close
- Menu appears instantly (no animation) when opened - immediate response
- Black backdrop overlay prevents purple gradient background from showing through during menu display
- Menu uses React Portal to render outside page flow - prevents overlap issues

### Logo Updates
- Increased mobile logo size by 60% (from 56px to 90px)
- Increased desktop logo size proportionally (from 90px to 115px)
- Logo now centered on mobile screens (previously left-aligned)
- Logo remains left-aligned on desktop
- Logo now more prominent on all screen sizes

### Animated Gradient Background
- Added CSS gradient animation background across all pages (purple/pink/blue colors)
- Background animates smoothly shifting colors over 12 seconds
- Gradient applied via inline styles in _app.js to ensure it loads correctly
- Note: WebGL-based 3D backgrounds not supported in Replit environment

## Recent Changes (November 3, 2025)
### Brand Update: Piks
- **Rebranded from "Funder" to "Piks"**:
  - Updated logo across all components (TopNavbar, ShareableBetSlip)
  - Changed all text references from "Funder"/"FundMyBet" to "Piks"
  - Updated meta tags and SEO content
  - New logo file: `/public/funderlogo/Piks.png`
  - Logo size increased by 125% for better visibility
  - Logo positioned slightly higher in navbar
- **Renamed "Thunder Card" to "Piks Card"** across all pages and navigation

### Simplified Demo Bet Slip
- **Removed Phase 1/Phase 2 progression system** from demo bet slip for cleaner UX
  - Removed phase toggle buttons, requirement tracking, and stats
  - Demo bet slip now focuses purely on core betting experience
  - Simpler interface without complexity of challenge phases

### Floating Bet Slip Button
- **Added scroll-aware floating bet slip button**:
  - Appears in bottom left corner when user scrolls down with demo bets selected
  - Automatically hides when scrolled to top (where header button is visible)
  - Smooth slide-in animation from left side
  - Shows bet count badge
  - Follows scroll position, always accessible without scrolling
  - Clean UX that maintains unobstructed view at top of page

### Mobile Demo Bet Slip Optimization
- **Optimized mobile demo bet slip for full-screen experience**:
  - Changed from 85vh to full screen (inset-0) on mobile
  - Removed rounded corners on mobile for true full-screen feel
  - Removed background showing through on mobile
  - Reduced padding and spacing throughout for compact mobile layout
  - Eliminated unnecessary scrolling by optimizing component sizes
  - Quick amount buttons, bet cards, and stats sections now more compact on mobile
  - Desktop version remains unchanged with floating panel design

### Bet Receipt & History Improvements
- **Created BetReceipt component** with professional bet confirmation display
  - Shows after every bet placed (demo or real)
  - Displays matchup, selection, bet type, odds, wager amount, profit "to win", and total "potential payout"
  - Auto-dismisses after 5 seconds or can be manually closed
  - Clearly distinguishes demo bets with DEMO badge
  - Supports both single and parlay bets with correct odds calculations
- **Integrated bet receipts into all betting flows**:
  - Demo homepage (DemoPreview component)
  - Demo dashboard betting
  - Real BetSlip component
  - Parlay bets show combined odds and correct payouts
- **Enhanced demo bet history**:
  - Demo bets now stored in localStorage with proper structure (id, status, profit fields)
  - bet-history page displays both demo and real bets with DEMO badge for demo bets
  - Demo bet history persists across browser sessions

### Technical Improvements
- **Fixed Next.js viewport meta tag warning** by removing viewport tag from _document.js (Next.js handles this automatically)

### Global Popups & Mobile Navigation Updates
- **Fixed GET FUNDED button** to work from all pages by moving ChallengePopup and HowItWorksPopup to _app.js
  - Popups are now globally available across all pages (not just homepage)
  - Event listeners for 'openChallengePopup' and 'openHowItWorks' now set up in _app.js
  - GET FUNDED button in TopNavbar works from /leaderboard, /demo, /waitlist, etc.
- **Added Demo link to mobile navigation** for non-logged-in users
  - Mobile hamburger menu now includes Demo option between Leaderboard and How It Works
  - Provides consistent navigation experience across desktop and mobile

### Demo Platform Experience (November 2, 2025)
- Added "Demo" link to TopNavbar for easy access to free trial experience
- Created complete demo flow without authentication requirement:
  - **/demo**: Full challenge customization page (balance selection, profit split adjustment)
  - **/demo-dashboard**: Fully functional betting dashboard with localStorage persistence
  - Demo allows users to experience all platform features before signing up
- Demo features:
  - Choose from 3 challenge tiers ($5k, $10k, $25k starting balance)
  - Customize profit split (50%-90%)
  - Full betting functionality with live games
  - Track bankroll, P&L, win rate, and total bets
  - All progress saved to localStorage (persists across browser sessions)
  - Reset demo option to start over
  - Easy conversion path to real account signup

### Navigation and Challenge Persistence Update (November 2, 2025)
- Changed "GET FUNDED" button in TopNavbar to trigger the ChallengePopup instead of linking to /packages
- Both "GET FUNDED" (top nav) and "Start a Challenge" (homepage) now open the same ChallengePopup component
- Implemented challenge selection persistence:
  - Challenge data (including user profit split, adjusted price, and license key) is stored in localStorage after payment
  - Auth page automatically loads purchased challenge from localStorage
  - If user is already authenticated, skips directly to challenge confirmation
  - Challenge data is saved to Supabase database after authentication
  - localStorage is cleared after successful database save
- This ensures users' challenge selections and customizations persist through the authentication flow

## Project Architecture

### Key Components
- **TopNavbar**: Main navigation bar with auth state-dependent display
- **ChallengePopup**: Modal for selecting and purchasing challenge tiers
- **AuthContext**: Manages user authentication state with Supabase
- **BetSlipContext**: Manages betting slip functionality
- **DemoPreview**: Allows non-authenticated users to try the platform

### Authentication Flow
1. User enters beta access code on BetaLanding page (password: `baldwin`)
2. Upon successful password entry, access stored in localStorage
3. User signs up/logs in via Supabase Auth (email + password)
4. Session persists via Supabase's `persistSession: true` configuration
5. User profile automatically created in `profiles` table upon first login
6. User can select and purchase a challenge tier
7. Challenge details and user state stored in database

### Challenge Tiers
1. **Starter Challenge**: $5,000 funding, $149 price, 80% profit split
2. **Pro Challenge**: $10,000 funding, $249 price, 80% profit split (most popular)
3. **Elite Challenge**: $25,000 funding, $399 price, 80% profit split

### Database Tables
- `profiles`: User profiles linked to Supabase auth
- `user_challenges`: Tracks purchased challenges and user progress
- Additional marketplace and betting-related tables

## Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- Stripe keys (for payment processing)

## Development Workflow
- Run with: `npm run dev` (configured on port 5000)
- Build with: `npm run build`
- Start production with: `npm start`

## User Preferences
None documented yet.
