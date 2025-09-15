import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { slackService } from "./services/slack";
import { schedulerService } from "./services/scheduler";
import { insertScheduledMessageSchema } from "./shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Start the message scheduler
  schedulerService.start();

  // Slack OAuth routes
  app.get("/api/slack/auth", async (req, res) => {
    try {
      const { authUrl, state } = await slackService.getAuthUrl(req);

      // Store state in httpOnly cookie for CSRF protection
      res.cookie("oauth_state", state, {
        httpOnly: true,
        secure: !req.get("host")?.includes("localhost"), // HTTPS in production, HTTP for localhost
        sameSite: "strict",
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      res.json({ authUrl });
    } catch (error) {
      console.error("Failed to get auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });
  app.get("/api/slack/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query; // Use req.query for GET parameters

      if (!code) {
        return res.status(400).json({ error: "Authorization code required" });
      }

      if (!state) {
        return res.status(400).json({ error: "State parameter required" });
      }

      // Retrieve stored state from cookie
      const storedState = req.cookies?.oauth_state;
      if (!storedState) {
        return res
          .status(400)
          .json({ error: "Missing stored state - possible CSRF attack" });
      }

      const codeStr = String(code);
      const stateStr = String(state);

      const tokenData = await slackService.exchangeCodeForToken(
        codeStr,
        stateStr,
        storedState,
        req
      );

      // Clear the state cookie after successful verification
      res.clearCookie("oauth_state");

      // For GET requests, redirect to your React app with success
      // You can redirect to a success page or dashboard
      res.redirect("/?slack_connected=true");
    } catch (error) {
      console.error("OAuth callback failed:", error);

      // Clear state cookie on error too
      res.clearCookie("oauth_state");

      // Redirect to error page
      res.redirect("/?slack_error=true");
    }
  });
  app.post("/api/slack/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Authorization code required" });
      }

      if (!state) {
        return res.status(400).json({ error: "State parameter required" });
      }

      // Retrieve stored state from cookie
      const storedState = req.cookies?.oauth_state;
      if (!storedState) {
        return res
          .status(400)
          .json({ error: "Missing stored state - possible CSRF attack" });
      }

      const tokenData = await slackService.exchangeCodeForToken(
        code,
        state,
        storedState,
        req
      );

      // Clear the state cookie after successful verification
      res.clearCookie("oauth_state");

      res.json({
        success: true,
        team: {
          id: tokenData.teamId,
          name: tokenData.teamName,
        },
        user: {
          id: tokenData.userId,
        },
      });
    } catch (error) {
      console.error("OAuth callback failed:", error);

      // Clear state cookie on error too
      res.clearCookie("oauth_state");

      if (
        error instanceof Error &&
        error.message?.includes("state parameter")
      ) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to complete OAuth flow" });
      }
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
        },
      });
    } catch (error) {
      console.error("Failed to check connection status:", error);
      res.status(500).json({ error: "Failed to check connection status" });
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
      console.error("Failed to disconnect:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  // Get channels
  app.get("/api/slack/channels/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const channels = await slackService.getChannels(teamId, userId);
      res.json(channels);
    } catch (error) {
      console.error("Failed to fetch channels:", error);

      if (
        error instanceof Error &&
        error.message === "Slack client not available"
      ) {
        return res
          .status(401)
          .json({ error: "Slack connection not available or expired" });
      }

      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  // Send immediate message
  app.post("/api/slack/send/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const { channel, message } = req.body;

      if (!channel || !message) {
        return res
          .status(400)
          .json({ error: "Channel and message are required" });
      }

      const messageTs = await slackService.sendMessage(
        teamId,
        userId,
        channel,
        message
      );

      // Track immediate send for stats
      try {
        await storage.incrementMessageSent(teamId, userId);
      } catch (statsError) {
        console.warn("Failed to update message stats:", statsError);
        // Don't fail the request if stats update fails
      }

      res.json({ success: true, messageTs });
    } catch (error) {
      console.error("Failed to send message:", error);

      if (error instanceof Error) {
        if (error.message === "Slack client not available") {
          return res
            .status(401)
            .json({ error: "Slack connection not available or expired" });
        }

        // Handle specific Slack API errors
        if (error.message.includes("channel_not_found")) {
          return res
            .status(400)
            .json({ error: "Channel not found or not accessible" });
        }

        if (error.message.includes("not_in_channel")) {
          return res
            .status(400)
            .json({ error: "Bot not in channel or insufficient permissions" });
        }

        if (error.message.includes("rate_limited")) {
          return res
            .status(429)
            .json({ error: "Rate limited - please try again later" });
        }

        // Return specific Slack error for better UX
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Schedule message
  app.post("/api/messages/schedule/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const messageData = { ...req.body, teamId, userId };

      // Convert scheduledFor string to Date object for validation
      if (
        messageData.scheduledFor &&
        typeof messageData.scheduledFor === "string"
      ) {
        messageData.scheduledFor = new Date(messageData.scheduledFor);
      }

      // Validate future date
      if (messageData.scheduledFor && messageData.scheduledFor <= new Date()) {
        return res
          .status(400)
          .json({ error: "Scheduled time must be in the future" });
      }

      // Server controls status - always set to pending
      messageData.status = "pending";

      const validatedData = insertScheduledMessageSchema.parse(messageData);
      const scheduledMessage = await storage.createScheduledMessage(
        validatedData
      );

      res.json(scheduledMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Invalid message data", details: error.errors });
      }
      console.error("Failed to schedule message:", error);
      res.status(500).json({ error: "Failed to schedule message" });
    }
  });

  // Get scheduled messages
  app.get("/api/messages/scheduled/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const messages = await storage.getScheduledMessages(teamId, userId);
      res.json(messages);
    } catch (error) {
      console.error("Failed to fetch scheduled messages:", error);
      res.status(500).json({ error: "Failed to fetch scheduled messages" });
    }
  });

  // Cancel scheduled message
  app.delete(
    "/api/messages/scheduled/:teamId/:userId/:id",
    async (req, res) => {
      try {
        const { teamId, userId, id } = req.params;
        const message = await storage.getScheduledMessage(id);

        if (!message) {
          return res.status(404).json({ error: "Message not found" });
        }

        // Verify ownership
        if (message.teamId !== teamId || message.userId !== userId) {
          return res
            .status(403)
            .json({ error: "Not authorized to cancel this message" });
        }

        if (message.status !== "pending") {
          return res
            .status(400)
            .json({ error: "Can only cancel pending messages" });
        }

        await storage.updateScheduledMessage(id, { status: "cancelled" });
        res.json({ success: true });
      } catch (error) {
        console.error("Failed to cancel message:", error);
        res.status(500).json({ error: "Failed to cancel message" });
      }
    }
  );

  // Get message statistics
  app.get("/api/messages/stats/:teamId/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;
      const messages = await storage.getScheduledMessages(teamId, userId);
      const channels = await storage.getSlackChannels(teamId);
      const immediateSends = await storage.getMessagesSentCount(teamId, userId);

      const stats = {
        messagesSent:
          messages.filter((m) => m.status === "sent").length + immediateSends,
        scheduledMessages: messages.filter((m) => m.status === "pending")
          .length,
        activeChannels: channels.length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
