import { WebClient } from "@slack/web-api";
import { storage } from "../storage";
import type { SlackToken } from "@shared/schema";

class SlackService {
  private clients: Map<string, WebClient> = new Map();

  private getClientKey(teamId: string, userId: string): string {
    return `${teamId}-${userId}`;
  }

  async getClient(teamId: string, userId: string): Promise<WebClient | null> {
    const key = this.getClientKey(teamId, userId);
    
    // Check if we have a cached client
    if (this.clients.has(key)) {
      return this.clients.get(key)!;
    }

    // Get token from storage
    const tokenData = await storage.getSlackToken(teamId, userId);
    if (!tokenData) {
      return null;
    }

    // Check if token is expired and refresh if possible
    if (tokenData.expiresAt && new Date() > tokenData.expiresAt) {
      if (tokenData.refreshToken) {
        try {
          await this.refreshToken(teamId, userId, tokenData.refreshToken);
          const updatedToken = await storage.getSlackToken(teamId, userId);
          if (!updatedToken) return null;
          tokenData.accessToken = updatedToken.accessToken;
        } catch (error) {
          console.error('Failed to refresh token:', error);
          return null;
        }
      } else {
        return null;
      }
    }

    // Create and cache client
    const client = new WebClient(tokenData.accessToken);
    this.clients.set(key, client);
    return client;
  }

  async refreshToken(teamId: string, userId: string, refreshToken: string): Promise<void> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Slack OAuth credentials not configured');
    }

    const client = new WebClient();
    
    try {
      const result = await client.oauth.v2.access({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      if (!result.ok || !result.access_token) {
        throw new Error('Failed to refresh token');
      }

      const expiresAt = result.expires_in 
        ? new Date(Date.now() + result.expires_in * 1000)
        : null;

      await storage.updateSlackToken(teamId, userId, {
        accessToken: result.access_token,
        refreshToken: result.refresh_token || refreshToken,
        expiresAt,
        updatedAt: new Date(),
      });

      // Clear cached client to force recreation with new token
      const key = this.getClientKey(teamId, userId);
      this.clients.delete(key);
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  async sendMessage(teamId: string, userId: string, channel: string, text: string): Promise<string> {
    const client = await this.getClient(teamId, userId);
    if (!client) {
      throw new Error('Slack client not available');
    }

    try {
      const result = await client.chat.postMessage({
        channel,
        text,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      // Update channel last used
      await storage.updateChannelLastUsed(channel, teamId);

      return result.ts!;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async getChannels(teamId: string, userId: string): Promise<any[]> {
    const client = await this.getClient(teamId, userId);
    if (!client) {
      throw new Error('Slack client not available');
    }

    try {
      const result = await client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 100,
      });

      if (!result.ok || !result.channels) {
        throw new Error('Failed to fetch channels');
      }

      // Store/update channels in storage
      for (const channel of result.channels) {
        const existingChannels = await storage.getSlackChannels(teamId);
        const exists = existingChannels.find(c => c.channelId === channel.id);
        
        if (!exists) {
          await storage.createSlackChannel({
            channelId: channel.id!,
            name: channel.name!,
            teamId,
            isPrivate: channel.is_private || false,
          });
        }
      }

      return result.channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
      }));
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      throw error;
    }
  }

  async getAuthUrl(): Promise<string> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error('Slack OAuth credentials not configured');
    }

    const scopes = [
      'channels:read',
      'groups:read',
      'chat:write',
      'users:read',
      'team:read',
    ];

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<SlackToken> {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Slack OAuth credentials not configured');
    }

    const client = new WebClient();

    try {
      const result = await client.oauth.v2.access({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      });

      if (!result.ok || !result.access_token) {
        throw new Error('Failed to exchange code for token');
      }

      const expiresAt = result.expires_in 
        ? new Date(Date.now() + result.expires_in * 1000)
        : null;

      const tokenData = {
        accessToken: result.access_token,
        refreshToken: result.refresh_token || null,
        teamId: result.team!.id!,
        teamName: result.team!.name!,
        userId: result.authed_user!.id!,
        expiresAt,
      };

      return await storage.createSlackToken(tokenData);
    } catch (error) {
      console.error('OAuth exchange failed:', error);
      throw error;
    }
  }

  clearClientCache(teamId: string, userId: string): void {
    const key = this.getClientKey(teamId, userId);
    this.clients.delete(key);
  }
}

export const slackService = new SlackService();
