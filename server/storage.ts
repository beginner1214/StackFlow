import { 
  type SlackToken, 
  type InsertSlackToken,
  type ScheduledMessage,
  type InsertScheduledMessage,
  type SlackChannel,
  type InsertSlackChannel,
  type User, 
  type InsertUser 
} from "server/shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Legacy user methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Slack token methods
  getSlackToken(teamId: string, userId: string): Promise<SlackToken | undefined>;
  createSlackToken(token: InsertSlackToken): Promise<SlackToken>;
  updateSlackToken(teamId: string, userId: string, updates: Partial<SlackToken>): Promise<SlackToken | undefined>;
  deleteSlackToken(teamId: string, userId: string): Promise<boolean>;
  
  // Scheduled message methods
  getScheduledMessages(teamId: string, userId: string): Promise<ScheduledMessage[]>;
  getScheduledMessage(id: string): Promise<ScheduledMessage | undefined>;
  createScheduledMessage(message: InsertScheduledMessage): Promise<ScheduledMessage>;
  updateScheduledMessage(id: string, updates: Partial<ScheduledMessage>): Promise<ScheduledMessage | undefined>;
  deleteScheduledMessage(id: string): Promise<boolean>;
  getPendingScheduledMessages(): Promise<ScheduledMessage[]>;
  
  // Slack channel methods
  getSlackChannels(teamId: string): Promise<SlackChannel[]>;
  createSlackChannel(channel: InsertSlackChannel): Promise<SlackChannel>;
  updateChannelLastUsed(channelId: string, teamId: string): Promise<void>;

  // Message statistics
  incrementMessageSent(teamId: string, userId: string): Promise<void>;
  getMessagesSentCount(teamId: string, userId: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private slackTokens: Map<string, SlackToken>;
  private scheduledMessages: Map<string, ScheduledMessage>;
  private slackChannels: Map<string, SlackChannel>;
  private messageCounts: Map<string, number>;

  constructor() {
    this.users = new Map();
    this.slackTokens = new Map();
    this.scheduledMessages = new Map();
    this.slackChannels = new Map();
    this.messageCounts = new Map();
  }

  // Legacy user methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Slack token methods
  private getTokenKey(teamId: string, userId: string): string {
    return `${teamId}-${userId}`;
  }

  async getSlackToken(teamId: string, userId: string): Promise<SlackToken | undefined> {
    return this.slackTokens.get(this.getTokenKey(teamId, userId));
  }

  async createSlackToken(insertToken: InsertSlackToken): Promise<SlackToken> {
    const id = randomUUID();
    const now = new Date();
    const token: SlackToken = { 
      ...insertToken, 
      id,
      refreshToken: insertToken.refreshToken || null,
      expiresAt: insertToken.expiresAt || null,
      createdAt: now,
      updatedAt: now
    };
    this.slackTokens.set(this.getTokenKey(token.teamId, token.userId), token);
    return token;
  }

  async updateSlackToken(teamId: string, userId: string, updates: Partial<SlackToken>): Promise<SlackToken | undefined> {
    const key = this.getTokenKey(teamId, userId);
    const existing = this.slackTokens.get(key);
    if (!existing) return undefined;
    
    const updated: SlackToken = { 
      ...existing, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.slackTokens.set(key, updated);
    return updated;
  }

  async deleteSlackToken(teamId: string, userId: string): Promise<boolean> {
    return this.slackTokens.delete(this.getTokenKey(teamId, userId));
  }

  // Scheduled message methods
  async getScheduledMessages(teamId: string, userId: string): Promise<ScheduledMessage[]> {
    return Array.from(this.scheduledMessages.values()).filter(
      (message) => message.teamId === teamId && message.userId === userId
    );
  }

  async getScheduledMessage(id: string): Promise<ScheduledMessage | undefined> {
    return this.scheduledMessages.get(id);
  }

  async createScheduledMessage(insertMessage: InsertScheduledMessage): Promise<ScheduledMessage> {
    const id = randomUUID();
    const now = new Date();
    const message: ScheduledMessage = { 
      ...insertMessage, 
      id,
      status: insertMessage.status || 'pending',
      channelName: insertMessage.channelName || null,
      timezone: insertMessage.timezone || 'UTC',
      createdAt: now,
      sentAt: null,
      errorMessage: null
    };
    this.scheduledMessages.set(id, message);
    return message;
  }

  async updateScheduledMessage(id: string, updates: Partial<ScheduledMessage>): Promise<ScheduledMessage | undefined> {
    const existing = this.scheduledMessages.get(id);
    if (!existing) return undefined;
    
    const updated: ScheduledMessage = { ...existing, ...updates };
    this.scheduledMessages.set(id, updated);
    return updated;
  }

  async deleteScheduledMessage(id: string): Promise<boolean> {
    return this.scheduledMessages.delete(id);
  }

  async getPendingScheduledMessages(): Promise<ScheduledMessage[]> {
    const now = new Date();
    return Array.from(this.scheduledMessages.values()).filter(
      (message) => message.status === 'pending' && message.scheduledFor <= now
    );
  }

  // Slack channel methods
  async getSlackChannels(teamId: string): Promise<SlackChannel[]> {
    return Array.from(this.slackChannels.values())
      .filter((channel) => channel.teamId === teamId)
      .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0));
  }

  async createSlackChannel(insertChannel: InsertSlackChannel): Promise<SlackChannel> {
    const id = randomUUID();
    const channel: SlackChannel = { 
      ...insertChannel, 
      id,
      isPrivate: insertChannel.isPrivate || null,
      lastUsed: new Date()
    };
    this.slackChannels.set(id, channel);
    return channel;
  }

  async updateChannelLastUsed(channelId: string, teamId: string): Promise<void> {
    const channel = Array.from(this.slackChannels.values()).find(
      (c) => c.channelId === channelId && c.teamId === teamId
    );
    if (channel) {
      channel.lastUsed = new Date();
    }
  }

  // Message statistics methods
  private getStatsKey(teamId: string, userId: string): string {
    return `${teamId}-${userId}`;
  }

  async incrementMessageSent(teamId: string, userId: string): Promise<void> {
    const key = this.getStatsKey(teamId, userId);
    const current = this.messageCounts.get(key) || 0;
    this.messageCounts.set(key, current + 1);
  }

  async getMessagesSentCount(teamId: string, userId: string): Promise<number> {
    const key = this.getStatsKey(teamId, userId);
    return this.messageCounts.get(key) || 0;
  }
}

export const storage = new MemStorage();
