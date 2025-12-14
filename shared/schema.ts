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
