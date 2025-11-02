# Funder - Sports Betting Challenge Platform

## Overview
Funder is a Next.js-based sports betting platform that provides users with funded challenges to bet with. Users can sign up for different challenge tiers, receive funded accounts, and keep a percentage of their profits.

## Current State
- **Framework**: Next.js 14.2.30
- **Authentication**: Supabase Auth (configured with phone/password login)
- **Database**: Supabase PostgreSQL
- **Styling**: Tailwind CSS
- **State Management**: React Context (AuthContext, BetSlipContext, UserProfilesContext)

## Recent Changes (November 2, 2025)
### Navigation and Challenge Persistence Update
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
1. User signs up/logs in via Supabase Auth (phone + password)
2. Session persists via Supabase's `persistSession: true` configuration
3. User profile automatically created in `profiles` table upon first login
4. User can select and purchase a challenge tier
5. Challenge details and user state stored in database

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
