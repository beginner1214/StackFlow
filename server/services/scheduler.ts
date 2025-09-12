import { storage } from "../storage";
import { slackService } from "./slack";

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;

  start(): void {
    if (this.intervalId) return;

    // Check for pending messages every minute
    this.intervalId = setInterval(async () => {
      await this.processPendingMessages();
    }, 60000);

    console.log('Message scheduler started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Message scheduler stopped');
    }
  }

  private async processPendingMessages(): Promise<void> {
    try {
      const pendingMessages = await storage.getPendingScheduledMessages();
      
      for (const message of pendingMessages) {
        await this.sendScheduledMessage(message.id);
      }
    } catch (error) {
      console.error('Error processing pending messages:', error);
    }
  }

  async sendScheduledMessage(messageId: string): Promise<void> {
    const message = await storage.getScheduledMessage(messageId);
    if (!message || message.status !== 'pending') {
      return;
    }

    try {
      await storage.updateScheduledMessage(messageId, { status: 'sending' });

      await slackService.sendMessage(
        message.teamId,
        message.userId,
        message.channel,
        message.content
      );

      await storage.updateScheduledMessage(messageId, {
        status: 'sent',
        sentAt: new Date(),
      });

      console.log(`Scheduled message ${messageId} sent successfully`);
    } catch (error) {
      console.error(`Failed to send scheduled message ${messageId}:`, error);
      
      await storage.updateScheduledMessage(messageId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const schedulerService = new SchedulerService();
