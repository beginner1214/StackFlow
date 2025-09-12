import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { slackService } from "./services/slack";
import { schedulerService } from "./services/scheduler";
import { insertScheduledMessageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Start the message scheduler
  schedulerService.start();

  // Slack OAuth routes
  app.get("/api/slack/auth", async (req, res) => {
    try {
      const authUrl = await slackService.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  });

  app.post("/api/slack/oauth/callback", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
      }

      const tokenData = await slackService.exchangeCodeForToken(code);
      res.json({ 
        success: true,
        team: {
          id: tokenData.teamId,
          name: tokenData.teamName,
        },
        user: {
          id: tokenData.userId,
        }
      });
    } catch (error) {
      console.error('OAuth callback failed:', error);
      res.status(500).json({ error: 'Failed to complete OAuth flow' });
    }
  });

  // Connection status
  app.get("/api/slack/status/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const tokenData = await storage.getSlackToken(teamId, userId);
      
      if (!tokenData) {
        return res.json({ connected: false });
      }

      // Check if token is expired
      if (tokenData.expiresAt && new Date() > tokenData.expiresAt) {
        return res.json({ connected: false, expired: true });
      }

      res.json({ 
        connected: true,
        team: {
          id: tokenData.teamId,
          name: tokenData.teamName,
        }
      });
    } catch (error) {
      console.error('Failed to check connection status:', error);
      res.status(500).json({ error: 'Failed to check connection status' });
    }
  });

  // Disconnect
  app.post("/api/slack/disconnect/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      await storage.deleteSlackToken(teamId, userId);
      slackService.clearClientCache(teamId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to disconnect:', error);
      res.status(500).json({ error: 'Failed to disconnect' });
    }
  });

  // Get channels
  app.get("/api/slack/channels/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const channels = await slackService.getChannels(teamId, userId);
      res.json(channels);
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  });

  // Send immediate message
  app.post("/api/slack/send/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const { channel, message } = req.body;

      if (!channel || !message) {
        return res.status(400).json({ error: 'Channel and message are required' });
      }

      const messageTs = await slackService.sendMessage(teamId, userId, channel, message);
      res.json({ success: true, messageTs });
    } catch (error) {
      console.error('Failed to send message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Schedule message
  app.post("/api/messages/schedule/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const messageData = { ...req.body, teamId, userId };

      const validatedData = insertScheduledMessageSchema.parse(messageData);
      const scheduledMessage = await storage.createScheduledMessage(validatedData);
      
      res.json(scheduledMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid message data', details: error.errors });
      }
      console.error('Failed to schedule message:', error);
      res.status(500).json({ error: 'Failed to schedule message' });
    }
  });

  // Get scheduled messages
  app.get("/api/messages/scheduled/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const messages = await storage.getScheduledMessages(teamId, userId);
      res.json(messages);
    } catch (error) {
      console.error('Failed to fetch scheduled messages:', error);
      res.status(500).json({ error: 'Failed to fetch scheduled messages' });
    }
  });

  // Cancel scheduled message
  app.delete("/api/messages/scheduled/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const message = await storage.getScheduledMessage(id);
      
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      if (message.status !== 'pending') {
        return res.status(400).json({ error: 'Can only cancel pending messages' });
      }

      await storage.updateScheduledMessage(id, { status: 'cancelled' });
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to cancel message:', error);
      res.status(500).json({ error: 'Failed to cancel message' });
    }
  });

  // Get message statistics
  app.get("/api/messages/stats/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const messages = await storage.getScheduledMessages(teamId, userId);
      const channels = await storage.getSlackChannels(teamId);

      const stats = {
        messagesSent: messages.filter(m => m.status === 'sent').length,
        scheduledMessages: messages.filter(m => m.status === 'pending').length,
        activeChannels: channels.length,
      };

      res.json(stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
