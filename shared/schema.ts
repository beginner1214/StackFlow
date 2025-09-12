import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const slackTokens = pgTable("slack_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  teamId: text("team_id").notNull(),
  teamName: text("team_name").notNull(),
  userId: text("user_id").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

export const scheduledMessages = pgTable("scheduled_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channel: text("channel").notNull(),
  channelName: text("channel_name"),
  content: text("content").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  timezone: text("timezone").notNull().default('UTC'),
  status: text("status").notNull().default('pending'), // pending, sent, cancelled, failed
  teamId: text("team_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
});

export const slackChannels = pgTable("slack_channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: text("channel_id").notNull(),
  name: text("name").notNull(),
  teamId: text("team_id").notNull(),
  isPrivate: boolean("is_private").default(false),
  lastUsed: timestamp("last_used").default(sql`now()`),
});

export const insertSlackTokenSchema = createInsertSchema(slackTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduledMessageSchema = createInsertSchema(scheduledMessages).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  status: true, // Server controls status
});

export const insertSlackChannelSchema = createInsertSchema(slackChannels).omit({
  id: true,
  lastUsed: true,
});

export type InsertSlackToken = z.infer<typeof insertSlackTokenSchema>;
export type SlackToken = typeof slackTokens.$inferSelect;

export type InsertScheduledMessage = z.infer<typeof insertScheduledMessageSchema>;
export type ScheduledMessage = typeof scheduledMessages.$inferSelect;

export type InsertSlackChannel = z.infer<typeof insertSlackChannelSchema>;
export type SlackChannel = typeof slackChannels.$inferSelect;

// Legacy user schema for compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
