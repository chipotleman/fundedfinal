import { sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }), // Hashed password (null for OAuth users)
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User profiles with betting data
export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey(), // References users.id
  username: varchar("username", { length: 100 }),
  avatar: text("avatar"), // Avatar URL or base64
  bio: text("bio"),
  bankroll: decimal("bankroll", { precision: 10, scale: 2 }).default('0').notNull(),
  challenge: jsonb("challenge"),
  challengeStartDate: timestamp("challenge_start_date"),
  status: varchar("status", { length: 50 }).default('inactive'),
  pnl: decimal("pnl", { precision: 10, scale: 2 }).default('0'),
  totalBets: integer("total_bets").default(0),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default('0'),
  betsHistory: jsonb("bets_history").default([]),
  challengePhase: integer("challenge_phase").default(1),
  dailyLoss: decimal("daily_loss", { precision: 10, scale: 2 }).default('0'),
  maxDailyLoss: decimal("max_daily_loss", { precision: 10, scale: 2 }),
  profitTarget: decimal("profit_target", { precision: 10, scale: 2 }),
  lastBetDate: timestamp("last_bet_date"),
  bettingDays: integer("betting_days").default(0),
  achievements: jsonb("achievements").default([]),
  profileStats: jsonb("profile_stats"),
  battleWins: integer("battle_wins").default(0),
  battleLosses: integer("battle_losses").default(0),
  totalWinnings: decimal("total_winnings", { precision: 12, scale: 2 }).default('0'),
  isFakeAccount: boolean("is_fake_account").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index("profiles_username_idx").on(table.username),
}));

// User bets
export const userBets = pgTable("user_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  matchupName: varchar("matchup_name", { length: 255 }),
  marketType: varchar("market_type", { length: 100 }),
  selection: varchar("selection", { length: 255 }),
  odds: varchar("odds", { length: 20 }),
  stake: decimal("stake", { precision: 10, scale: 2 }),
  potentialPayout: decimal("potential_payout", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 50 }).default('pending'),
  pnl: decimal("pnl", { precision: 10, scale: 2 }),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }),
  legs: jsonb("legs"), // Store parlay leg details
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  homeTeamFull: varchar("home_team_full", { length: 255 }),
  awayTeamFull: varchar("away_team_full", { length: 255 }),
  placedAt: timestamp("placed_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// NextAuth.js required tables
export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  id_token: text("id_token"),
  session_state: varchar("session_state", { length: 255 }),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  userId: varchar("user_id").notNull(),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
});

export const userChallenges = pgTable("user_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  challengeType: varchar("challenge_type", { length: 50 }).notNull(),
  challengeName: varchar("challenge_name", { length: 255 }).notNull(),
  startingBalance: decimal("starting_balance", { precision: 10, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).notNull(),
  userSplit: integer("user_split").notNull(),
  pricePaid: decimal("price_paid", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default('active').notNull(),
  phase: integer("phase").default(1).notNull(),
  pnl: decimal("pnl", { precision: 10, scale: 2 }).default('0'),
  totalBets: integer("total_bets").default(0),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default('0'),
  dailyLoss: decimal("daily_loss", { precision: 10, scale: 2 }).default('0'),
  maxDailyLoss: decimal("max_daily_loss", { precision: 10, scale: 2 }),
  profitTarget: decimal("profit_target", { precision: 10, scale: 2 }),
  transactionId: varchar("transaction_id", { length: 255 }).unique(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  activatedAt: timestamp("activated_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_challenges_user_id_idx").on(table.userId),
  transactionIdIdx: index("user_challenges_transaction_id_idx").on(table.transactionId),
}));

// Admin users table for separate admin authentication
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
});

// Admin staff with roles and permissions
export const adminStaff = pgTable("admin_staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 50 }).default('staff').notNull(),
  permissions: jsonb("permissions").default([]),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
}, (table) => ({
  emailIdx: index("admin_staff_email_idx").on(table.email),
  roleIdx: index("admin_staff_role_idx").on(table.role),
}));

// User events tracking for analytics
export const userEvents = pgTable("user_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  visitorId: varchar("visitor_id", { length: 255 }),
  sessionId: varchar("session_id", { length: 255 }),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  eventData: jsonb("event_data"),
  pageUrl: varchar("page_url", { length: 500 }),
  referrer: varchar("referrer", { length: 500 }),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("user_events_user_id_idx").on(table.userId),
  sessionIdIdx: index("user_events_session_id_idx").on(table.sessionId),
  eventTypeIdx: index("user_events_event_type_idx").on(table.eventType),
  createdAtIdx: index("user_events_created_at_idx").on(table.createdAt),
}));

// Session metrics for time tracking
export const sessionMetrics = pgTable("session_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  visitorId: varchar("visitor_id", { length: 255 }),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"),
  pagesViewed: integer("pages_viewed").default(0),
  eventsCount: integer("events_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("session_metrics_user_id_idx").on(table.userId),
  sessionIdIdx: index("session_metrics_session_id_idx").on(table.sessionId),
}));

// Demo bets tracking
export const demoBets = pgTable("demo_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  visitorId: varchar("visitor_id", { length: 255 }),
  sessionId: varchar("session_id", { length: 255 }),
  matchupName: varchar("matchup_name", { length: 255 }),
  marketType: varchar("market_type", { length: 100 }),
  selection: varchar("selection", { length: 255 }),
  odds: varchar("odds", { length: 20 }),
  stake: decimal("stake", { precision: 10, scale: 2 }),
  potentialPayout: decimal("potential_payout", { precision: 10, scale: 2 }),
  result: varchar("result", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("demo_bets_user_id_idx").on(table.userId),
  visitorIdIdx: index("demo_bets_visitor_id_idx").on(table.visitorId),
}));

// Unplaced bets tracking (bets added to slip but not placed)
export const unplacedBets = pgTable("unplaced_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  visitorId: varchar("visitor_id", { length: 255 }),
  sessionId: varchar("session_id", { length: 255 }),
  matchupName: varchar("matchup_name", { length: 255 }),
  marketType: varchar("market_type", { length: 100 }),
  selection: varchar("selection", { length: 255 }),
  odds: varchar("odds", { length: 20 }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  removedAt: timestamp("removed_at"),
  wasPlaced: boolean("was_placed").default(false),
}, (table) => ({
  userIdIdx: index("unplaced_bets_user_id_idx").on(table.userId),
  sessionIdIdx: index("unplaced_bets_session_id_idx").on(table.sessionId),
}));

// Page views tracking
export const pageViews = pgTable("page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  visitorId: varchar("visitor_id", { length: 255 }),
  sessionId: varchar("session_id", { length: 255 }),
  pageUrl: varchar("page_url", { length: 500 }).notNull(),
  pageTitle: varchar("page_title", { length: 255 }),
  referrer: varchar("referrer", { length: 500 }),
  timeOnPage: integer("time_on_page"),
  scrollDepth: integer("scroll_depth"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("page_views_user_id_idx").on(table.userId),
  sessionIdIdx: index("page_views_session_id_idx").on(table.sessionId),
  createdAtIdx: index("page_views_created_at_idx").on(table.createdAt),
}));

// Saved payment methods for withdrawals
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  methodType: varchar("method_type", { length: 50 }).notNull(), // bank_transfer, instant_transfer, venmo, wire, check
  nickname: varchar("nickname", { length: 100 }),
  isDefault: boolean("is_default").default(false),
  // Bank transfer fields
  bankName: varchar("bank_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 50 }), // Last 4 stored
  routingNumber: varchar("routing_number", { length: 20 }),
  accountType: varchar("account_type", { length: 20 }), // checking, savings
  // Instant transfer (debit card)
  cardLast4: varchar("card_last4", { length: 4 }),
  cardBrand: varchar("card_brand", { length: 20 }),
  cardExpiry: varchar("card_expiry", { length: 10 }),
  // Venmo
  venmoUsername: varchar("venmo_username", { length: 100 }),
  // Wire transfer
  swiftCode: varchar("swift_code", { length: 20 }),
  // Check
  mailingAddress: jsonb("mailing_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("payment_methods_user_id_idx").on(table.userId),
}));

// Withdrawal requests
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  paymentMethodId: varchar("payment_method_id"),
  methodType: varchar("method_type", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 10, scale: 2 }).default('0'),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default('under_review').notNull(), // under_review, awaiting_processing, finalized, denied
  statusHistory: jsonb("status_history").default([]),
  paymentDetails: jsonb("payment_details"), // Stores method-specific details
  adminNotes: text("admin_notes"),
  denialReason: text("denial_reason"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  processedAt: timestamp("processed_at"),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("withdrawals_user_id_idx").on(table.userId),
  statusIdx: index("withdrawals_status_idx").on(table.status),
  createdAtIdx: index("withdrawals_created_at_idx").on(table.createdAt),
}));

// Odds history pulls for admin download
export const oddsHistoryPulls = pgTable("odds_history_pulls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pulledAt: timestamp("pulled_at").defaultNow().notNull(),
  gamesCount: integer("games_count").default(0),
  sportsData: jsonb("sports_data").notNull(), // All games with all bookmaker odds
  creditUsed: integer("credit_used").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pulledAtIdx: index("odds_history_pulls_pulled_at_idx").on(table.pulledAt),
}));

// Completed games - stores game results for bet grading
export const completedGames = pgTable("completed_games", {
  id: varchar("id").primaryKey(), // Use the game ID from The Odds API
  sport: varchar("sport", { length: 100 }),
  homeTeam: varchar("home_team", { length: 100 }),
  awayTeam: varchar("away_team", { length: 100 }),
  homeTeamFull: varchar("home_team_full", { length: 255 }),
  awayTeamFull: varchar("away_team_full", { length: 255 }),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  commenceTime: timestamp("commence_time"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  matchupIdx: index("completed_games_matchup_idx").on(table.homeTeamFull, table.awayTeamFull),
  completedAtIdx: index("completed_games_completed_at_idx").on(table.completedAt),
}));

// ===== MARKETPLACE TABLES =====

// Verified cappers who can sell on the marketplace
export const cappers = pgTable("cappers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(), // References users.id
  displayName: varchar("display_name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(), // URL-friendly identifier
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  specialties: jsonb("specialties").default([]), // ["NBA", "NFL", "MLB"]
  discordGuildId: varchar("discord_guild_id", { length: 100 }),
  discordRoleId: varchar("discord_role_id", { length: 100 }),
  discordInviteLink: varchar("discord_invite_link", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(), // Piks Verified badge
  verifiedAt: timestamp("verified_at"),
  totalSubscribers: integer("total_subscribers").default(0),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default('0'),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default('0'),
  totalReviews: integer("total_reviews").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("cappers_user_id_idx").on(table.userId),
  slugIdx: index("cappers_slug_idx").on(table.slug),
  isActiveIdx: index("cappers_is_active_idx").on(table.isActive),
}));

// Products/passes that cappers sell
export const capperProducts = pgTable("capper_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  capperId: varchar("capper_id").notNull(), // References cappers.id
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).default('subscription').notNull(), // subscription, one_time
  duration: varchar("duration", { length: 50 }).notNull(), // daily, weekly, monthly, yearly, lifetime
  durationDays: integer("duration_days").notNull(), // Actual days for the subscription
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  features: jsonb("features").default([]), // List of included features
  includesDiscord: boolean("includes_discord").default(true),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  fanbasisProductId: varchar("fanbasis_product_id", { length: 255 }), // Fanbasis payment integration
  stripeProductId: varchar("stripe_product_id", { length: 255 }), // Backup for Stripe
  totalSales: integer("total_sales").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  capperIdIdx: index("capper_products_capper_id_idx").on(table.capperId),
  isActiveIdx: index("capper_products_is_active_idx").on(table.isActive),
}));

// Subscriptions purchased by buyers
export const capperSubscriptions = pgTable("capper_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(), // References capperProducts.id
  capperId: varchar("capper_id").notNull(), // References cappers.id (denormalized for queries)
  buyerId: varchar("buyer_id").notNull(), // References users.id
  status: varchar("status", { length: 50 }).default('active').notNull(), // active, expired, cancelled, paused
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  autoRenew: boolean("auto_renew").default(false),
  discordMemberAdded: boolean("discord_member_added").default(false),
  discordAddedAt: timestamp("discord_added_at"),
  discordRemovedAt: timestamp("discord_removed_at"),
  fanbasisSubscriptionId: varchar("fanbasis_subscription_id", { length: 255 }),
  fanbasisTransactionId: varchar("fanbasis_transaction_id", { length: 255 }),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productIdIdx: index("capper_subscriptions_product_id_idx").on(table.productId),
  capperIdIdx: index("capper_subscriptions_capper_id_idx").on(table.capperId),
  buyerIdIdx: index("capper_subscriptions_buyer_id_idx").on(table.buyerId),
  statusIdx: index("capper_subscriptions_status_idx").on(table.status),
  expiresAtIdx: index("capper_subscriptions_expires_at_idx").on(table.expiresAt),
}));

// Reviews left by buyers for cappers
export const capperReviews = pgTable("capper_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  capperId: varchar("capper_id").notNull(), // References cappers.id
  buyerId: varchar("buyer_id").notNull(), // References users.id
  subscriptionId: varchar("subscription_id").notNull(), // References capperSubscriptions.id
  rating: integer("rating").notNull(), // 1-5 stars
  title: varchar("title", { length: 200 }),
  comment: text("comment"),
  status: varchar("status", { length: 50 }).default('pending').notNull(), // pending, approved, rejected, flagged
  isVerifiedPurchase: boolean("is_verified_purchase").default(true).notNull(),
  helpfulCount: integer("helpful_count").default(0),
  capperResponse: text("capper_response"),
  capperRespondedAt: timestamp("capper_responded_at"),
  moderatedBy: varchar("moderated_by"),
  moderatedAt: timestamp("moderated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  capperIdIdx: index("capper_reviews_capper_id_idx").on(table.capperId),
  buyerIdIdx: index("capper_reviews_buyer_id_idx").on(table.buyerId),
  statusIdx: index("capper_reviews_status_idx").on(table.status),
  ratingIdx: index("capper_reviews_rating_idx").on(table.rating),
}));

// Discord OAuth links for cappers
export const discordLinks = pgTable("discord_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  capperId: varchar("capper_id").notNull().unique(), // References cappers.id
  discordUserId: varchar("discord_user_id", { length: 100 }),
  discordUsername: varchar("discord_username", { length: 100 }),
  accessToken: text("access_token"), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  guildId: varchar("guild_id", { length: 100 }),
  guildName: varchar("guild_name", { length: 255 }),
  memberRoleId: varchar("member_role_id", { length: 100 }),
  botAdded: boolean("bot_added").default(false),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  capperIdIdx: index("discord_links_capper_id_idx").on(table.capperId),
}));

// Performance snapshots for cappers (computed from their bets)
export const capperPerformance = pgTable("capper_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  capperId: varchar("capper_id").notNull(), // References cappers.id
  period: varchar("period", { length: 50 }).notNull(), // daily, weekly, monthly, all_time
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalBets: integer("total_bets").default(0),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  pushes: integer("pushes").default(0),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default('0'),
  roi: decimal("roi", { precision: 8, scale: 2 }).default('0'),
  totalWagered: decimal("total_wagered", { precision: 12, scale: 2 }).default('0'),
  totalProfit: decimal("total_profit", { precision: 12, scale: 2 }).default('0'),
  averageOdds: decimal("average_odds", { precision: 6, scale: 2 }).default('0'),
  currentStreak: integer("current_streak").default(0), // Positive = wins, negative = losses
  bestStreak: integer("best_streak").default(0),
  sportBreakdown: jsonb("sport_breakdown").default({}), // Stats per sport
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  capperIdIdx: index("capper_performance_capper_id_idx").on(table.capperId),
  periodIdx: index("capper_performance_period_idx").on(table.period),
  periodStartIdx: index("capper_performance_period_start_idx").on(table.periodStart),
}));

// 1v1 Matchups - The actual battle between two participants
export const matchups = pgTable("matchups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeType: varchar("challenge_type", { length: 50 }).notNull(), // starter, pro, elite
  startingBalance: decimal("starting_balance", { precision: 10, scale: 2 }).notNull(),
  potSize: decimal("pot_size", { precision: 10, scale: 2 }).notNull(), // Total pot (2x starting balance)
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // 10% of pot
  winnerPayout: decimal("winner_payout", { precision: 10, scale: 2 }).notNull(), // pot - fee
  
  // Participant 1 (real user)
  user1Id: varchar("user1_id").notNull(),
  user1ChallengeId: varchar("user1_challenge_id"),
  user1Balance: decimal("user1_balance", { precision: 10, scale: 2 }).notNull(),
  user1FinalBalance: decimal("user1_final_balance", { precision: 10, scale: 2 }),
  
  // Participant 2 (real user or fake opponent)
  user2Id: varchar("user2_id"), // null until matched
  user2ChallengeId: varchar("user2_challenge_id"),
  user2Balance: decimal("user2_balance", { precision: 10, scale: 2 }),
  user2FinalBalance: decimal("user2_final_balance", { precision: 10, scale: 2 }),
  isFakeOpponent: boolean("is_fake_opponent").default(false),
  fakeOpponentId: varchar("fake_opponent_id"),
  
  // Timing
  durationMinutes: integer("duration_minutes").default(1440).notNull(), // Default 24 hours (1440 min)
  durationType: varchar("duration_type", { length: 50 }).default('1_day'), // 30_min, 1_day, 3_days, etc
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  
  // Status
  status: varchar("status", { length: 50 }).default('waiting').notNull(), // waiting, matched, active, completed, cancelled
  winnerId: varchar("winner_id"),
  winnerType: varchar("winner_type", { length: 20 }), // user1, user2, tie
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  user1IdIdx: index("matchups_user1_id_idx").on(table.user1Id),
  user2IdIdx: index("matchups_user2_id_idx").on(table.user2Id),
  statusIdx: index("matchups_status_idx").on(table.status),
  challengeTypeIdx: index("matchups_challenge_type_idx").on(table.challengeType),
}));

// Matchup Queue - Users waiting to be matched
export const matchupQueue = pgTable("matchup_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  challengeId: varchar("challenge_id"), // Optional - can use profile data instead
  challengeType: varchar("challenge_type", { length: 50 }).notNull(),
  startingBalance: decimal("starting_balance", { precision: 10, scale: 2 }).notNull(),
  durationType: varchar("duration_type", { length: 50 }).default('1_day'),
  status: varchar("status", { length: 50 }).default('waiting').notNull(), // waiting, matched, expired
  matchupId: varchar("matchup_id"), // Set when matched
  queuedAt: timestamp("queued_at").defaultNow().notNull(),
  matchedAt: timestamp("matched_at"),
  expiresAt: timestamp("expires_at"), // Auto-expire from queue
}, (table) => ({
  userIdIdx: index("matchup_queue_user_id_idx").on(table.userId),
  statusIdx: index("matchup_queue_status_idx").on(table.status),
  challengeTypeIdx: index("matchup_queue_challenge_type_idx").on(table.challengeType),
}));

// Fake Opponents - Admin-controlled profiles for when no real match is found
export const fakeOpponents = pgTable("fake_opponents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // Links to users table for authentication
  email: varchar("email", { length: 255 }), // Login email for this fake account
  hashedPassword: varchar("hashed_password", { length: 255 }), // Bcrypt hashed password
  username: varchar("username", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  avatar: text("avatar"), // URL or base64 avatar
  bio: text("bio"),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }).default('52.5'), // Fake win rate to display
  totalBattles: integer("total_battles").default(0), // Fake battle count
  isActive: boolean("is_active").default(true),
  lastImpersonatedAt: timestamp("last_impersonated_at"), // Track admin impersonation
  lastImpersonatedBy: varchar("last_impersonated_by"), // Admin who last impersonated
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index("fake_opponents_username_idx").on(table.username),
  isActiveIdx: index("fake_opponents_is_active_idx").on(table.isActive),
  userIdIdx: index("fake_opponents_user_id_idx").on(table.userId),
  emailIdx: index("fake_opponents_email_idx").on(table.email),
}));

// Fake Opponent Bets - Bets made by admins on behalf of fake opponents
export const fakeOpponentBets = pgTable("fake_opponent_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchupId: varchar("matchup_id").notNull(),
  fakeOpponentId: varchar("fake_opponent_id").notNull(),
  matchupName: varchar("matchup_name", { length: 255 }),
  marketType: varchar("market_type", { length: 100 }),
  selection: varchar("selection", { length: 255 }),
  odds: varchar("odds", { length: 20 }),
  stake: decimal("stake", { precision: 10, scale: 2 }),
  potentialPayout: decimal("potential_payout", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 50 }).default('pending'), // pending, won, lost, push
  pnl: decimal("pnl", { precision: 10, scale: 2 }),
  placedByAdminId: varchar("placed_by_admin_id"),
  homeTeamFull: varchar("home_team_full", { length: 255 }),
  awayTeamFull: varchar("away_team_full", { length: 255 }),
  legs: jsonb("legs"),
  placedAt: timestamp("placed_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
}, (table) => ({
  matchupIdIdx: index("fake_opponent_bets_matchup_id_idx").on(table.matchupId),
  fakeOpponentIdIdx: index("fake_opponent_bets_fake_opponent_id_idx").on(table.fakeOpponentId),
  statusIdx: index("fake_opponent_bets_status_idx").on(table.status),
}));

// Discord member management job queue
export const discordJobs = pgTable("discord_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull(), // References capperSubscriptions.id
  capperId: varchar("capper_id").notNull(),
  buyerId: varchar("buyer_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(), // add_member, remove_member
  status: varchar("status", { length: 50 }).default('pending').notNull(), // pending, processing, completed, failed
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  lastError: text("last_error"),
  processedAt: timestamp("processed_at"),
  scheduledFor: timestamp("scheduled_for").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("discord_jobs_status_idx").on(table.status),
  scheduledForIdx: index("discord_jobs_scheduled_for_idx").on(table.scheduledFor),
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;
export type UserBet = typeof userBets.$inferSelect;
export type InsertUserBet = typeof userBets.$inferInsert;
export type UserChallenge = typeof userChallenges.$inferSelect;
export type InsertUserChallenge = typeof userChallenges.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;
export type AdminStaff = typeof adminStaff.$inferSelect;
export type InsertAdminStaff = typeof adminStaff.$inferInsert;
export type UserEvent = typeof userEvents.$inferSelect;
export type InsertUserEvent = typeof userEvents.$inferInsert;
export type SessionMetric = typeof sessionMetrics.$inferSelect;
export type InsertSessionMetric = typeof sessionMetrics.$inferInsert;
export type DemoBet = typeof demoBets.$inferSelect;
export type InsertDemoBet = typeof demoBets.$inferInsert;
export type UnplacedBet = typeof unplacedBets.$inferSelect;
export type InsertUnplacedBet = typeof unplacedBets.$inferInsert;
export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = typeof withdrawals.$inferInsert;
export type OddsHistoryPull = typeof oddsHistoryPulls.$inferSelect;
export type InsertOddsHistoryPull = typeof oddsHistoryPulls.$inferInsert;
export type CompletedGame = typeof completedGames.$inferSelect;
export type InsertCompletedGame = typeof completedGames.$inferInsert;
export type Capper = typeof cappers.$inferSelect;
export type InsertCapper = typeof cappers.$inferInsert;
export type CapperProduct = typeof capperProducts.$inferSelect;
export type InsertCapperProduct = typeof capperProducts.$inferInsert;
export type CapperSubscription = typeof capperSubscriptions.$inferSelect;
export type InsertCapperSubscription = typeof capperSubscriptions.$inferInsert;
export type CapperReview = typeof capperReviews.$inferSelect;
export type InsertCapperReview = typeof capperReviews.$inferInsert;
export type DiscordLink = typeof discordLinks.$inferSelect;
export type InsertDiscordLink = typeof discordLinks.$inferInsert;
export type CapperPerformanceRecord = typeof capperPerformance.$inferSelect;
export type InsertCapperPerformance = typeof capperPerformance.$inferInsert;
export type DiscordJob = typeof discordJobs.$inferSelect;
export type InsertDiscordJob = typeof discordJobs.$inferInsert;
export type Matchup = typeof matchups.$inferSelect;
export type InsertMatchup = typeof matchups.$inferInsert;
export type MatchupQueueEntry = typeof matchupQueue.$inferSelect;
export type InsertMatchupQueueEntry = typeof matchupQueue.$inferInsert;
export type FakeOpponent = typeof fakeOpponents.$inferSelect;
export type InsertFakeOpponent = typeof fakeOpponents.$inferInsert;
export type FakeOpponentBet = typeof fakeOpponentBets.$inferSelect;
export type InsertFakeOpponentBet = typeof fakeOpponentBets.$inferInsert;

// Pik Pools - Multi-player betting competitions
export const pikPools = pgTable("pik_pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  buyIn: decimal("buy_in", { precision: 10, scale: 2 }).notNull(), // Entry fee (e.g., $25)
  startingBalance: decimal("starting_balance", { precision: 10, scale: 2 }).default('1000').notNull(),
  minPlayers: integer("min_players").default(5).notNull(),
  maxPlayers: integer("max_players").default(25).notNull(),
  currentPlayers: integer("current_players").default(0).notNull(),
  platformFeePercent: decimal("platform_fee_percent", { precision: 5, scale: 2 }).default('10').notNull(), // 10%
  prizePool: decimal("prize_pool", { precision: 12, scale: 2 }).default('0').notNull(), // Total collected after fee
  durationMinutes: integer("duration_minutes").default(1440).notNull(), // Default 24 hours
  durationType: varchar("duration_type", { length: 50 }).default('1_day'),
  status: varchar("status", { length: 50 }).default('open').notNull(), // open, filling, active, completed, cancelled
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  winnerId: varchar("winner_id"),
  winnerPayout: decimal("winner_payout", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("pik_pools_status_idx").on(table.status),
  startsAtIdx: index("pik_pools_starts_at_idx").on(table.startsAt),
}));

// Pool Participants
export const poolParticipants = pgTable("pool_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poolId: varchar("pool_id").notNull(),
  userId: varchar("user_id").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(), // Current balance in pool
  finalBalance: decimal("final_balance", { precision: 10, scale: 2 }),
  placement: integer("placement"), // Final rank (1st, 2nd, etc.)
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => ({
  poolIdIdx: index("pool_participants_pool_id_idx").on(table.poolId),
  userIdIdx: index("pool_participants_user_id_idx").on(table.userId),
  poolUserIdx: index("pool_participants_pool_user_idx").on(table.poolId, table.userId),
}));

// Pool Bets - Bets made within a pool competition
export const poolBets = pgTable("pool_bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poolId: varchar("pool_id").notNull(),
  userId: varchar("user_id").notNull(),
  matchupName: varchar("matchup_name", { length: 255 }),
  marketType: varchar("market_type", { length: 100 }),
  selection: varchar("selection", { length: 255 }),
  odds: varchar("odds", { length: 20 }),
  stake: decimal("stake", { precision: 10, scale: 2 }),
  potentialPayout: decimal("potential_payout", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 50 }).default('pending'), // pending, won, lost, push
  pnl: decimal("pnl", { precision: 10, scale: 2 }),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }),
  legs: jsonb("legs"),
  homeTeamFull: varchar("home_team_full", { length: 255 }),
  awayTeamFull: varchar("away_team_full", { length: 255 }),
  placedAt: timestamp("placed_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
}, (table) => ({
  poolIdIdx: index("pool_bets_pool_id_idx").on(table.poolId),
  userIdIdx: index("pool_bets_user_id_idx").on(table.userId),
  statusIdx: index("pool_bets_status_idx").on(table.status),
}));

export type PikPool = typeof pikPools.$inferSelect;
export type InsertPikPool = typeof pikPools.$inferInsert;
export type PoolParticipant = typeof poolParticipants.$inferSelect;
export type InsertPoolParticipant = typeof poolParticipants.$inferInsert;
export type PoolBet = typeof poolBets.$inferSelect;
export type InsertPoolBet = typeof poolBets.$inferInsert;
