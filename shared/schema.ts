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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  placedAt: timestamp("placed_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
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
