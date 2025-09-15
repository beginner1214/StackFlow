import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { apiRequest } from "../lib/queryClient";
import { Button } from "./ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";

const messageSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  content: z
    .string()
    .min(1, "Message content is required")
    .max(4000, "Message too long"),
  isScheduled: z.boolean().default(false),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  timezone: z.string().default("UTC"),
});

type MessageFormData = z.infer<typeof messageSchema>;

export default function ComposeSection() {
  const { teamId, userId } = useAuth();
  const { toast } = useToast();

  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      channel: "",
      content: "",
      isScheduled: false,
      timezone: "UTC",
    },
  });

  const { data: channels, isLoading: channelsLoading } = useQuery<
    Array<{
      id: string;
      name: string;
      isPrivate: boolean;
    }>
  >({
    queryKey: ["/api/slack/channels", teamId, userId],
    enabled: !!(teamId && userId),
  });

  const { data: stats, refetch: refetchStats } = useQuery<{
    messagesSent: number;
    scheduledMessages: number;
    activeChannels: number;
  }>({
    queryKey: ["/api/messages/stats", teamId, userId],
    enabled: !!(teamId && userId),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { channel: string; message: string }) => {
      return apiRequest("POST", `/api/slack/send/${teamId}/${userId}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully!",
      });
      form.reset();
      refetchStats();
    },
    onError: (error) => {
      toast({
        title: "Failed to Send",
        description:
          error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const scheduleMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(
        "POST",
        `/api/messages/schedule/${teamId}/${userId}`,
        data
      );
    },
    onSuccess: () => {
      toast({
        title: "Message Scheduled",
        description: "Your message has been scheduled successfully!",
      });
      form.reset();
      refetchStats();
    },
    onError: (error) => {
      toast({
        title: "Failed to Schedule",
        description:
          error instanceof Error ? error.message : "Failed to schedule message",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: MessageFormData) => {
    if (data.isScheduled) {
      if (!data.scheduledDate || !data.scheduledTime) {
        toast({
          title: "Invalid Schedule",
          description:
            "Please specify both date and time for scheduled messages",
          variant: "destructive",
        });
        return;
      }

      const scheduledFor = new Date(
        `${data.scheduledDate}T${data.scheduledTime}`
      );

      if (scheduledFor <= new Date()) {
        toast({
          title: "Invalid Schedule",
          description: "Scheduled time must be in the future",
          variant: "destructive",
        });
        return;
      }

      const scheduleData = {
        channel: data.channel,
        content: data.content,
        scheduledFor: scheduledFor.toISOString(),
        timezone: data.timezone,
        status: "pending",
      };

      scheduleMessageMutation.mutate(scheduleData);
    } else {
      sendMessageMutation.mutate({
        channel: data.channel,
        message: data.content,
      });
    }
  };

  const handleClear = () => {
    form.reset();
  };

  const isScheduled = form.watch("isScheduled");
  const content = form.watch("content");
  const characterCount = content?.length || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Compose Message
        </h2>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Channel</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-channel">
                        <SelectValue placeholder="Choose a channel..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {channelsLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading channels...
                        </SelectItem>
                      ) : channels?.length ? (
                        channels.map((channel: any) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.isPrivate ? "🔒" : "#"} {channel.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-channels" disabled>
                          No channels available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Type your message here..."
                      className="resize-none"
                      rows={4}
                      data-testid="textarea-message"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between items-center mt-2">
                    <span
                      className={`text-xs ${
                        characterCount > 4000
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                      data-testid="text-character-count"
                    >
                      {characterCount} / 4000 characters
                    </span>
                  </div>
                </FormItem>
              )}
            />

            <div className="bg-muted rounded-lg p-4">
              <FormField
                control={form.control}
                name="isScheduled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 mb-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-schedule"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Schedule message for later</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {isScheduled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            data-testid="input-date"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            data-testid="input-time"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="md:col-span-2">
                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-timezone">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="UTC">
                                UTC (Coordinated Universal Time)
                              </SelectItem>
                              <SelectItem value="America/New_York">
                                EST (Eastern Standard Time)
                              </SelectItem>
                              <SelectItem value="America/Los_Angeles">
                                PST (Pacific Standard Time)
                              </SelectItem>
                              <SelectItem value="Europe/London">
                                GMT (Greenwich Mean Time)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <Button
                type="submit"
                disabled={
                  sendMessageMutation.isPending ||
                  scheduleMessageMutation.isPending
                }
                data-testid="button-send"
              >
                <i className="fas fa-paper-plane mr-2"></i>
                {isScheduled ? "Schedule Message" : "Send Now"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClear}
                data-testid="button-clear"
              >
                <i className="fas fa-times mr-2"></i>Clear
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <i className="fas fa-check text-green-600 dark:text-green-400"></i>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Messages Sent</h3>
              <p
                className="text-2xl font-bold text-foreground"
                data-testid="text-messages-sent"
              >
                {stats?.messagesSent || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <i className="fas fa-clock text-yellow-600 dark:text-yellow-400"></i>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Scheduled</h3>
              <p
                className="text-2xl font-bold text-foreground"
                data-testid="text-scheduled-messages"
              >
                {stats?.scheduledMessages || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <i className="fas fa-users text-blue-600 dark:text-blue-400"></i>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Active Channels</h3>
              <p
                className="text-2xl font-bold text-foreground"
                data-testid="text-active-channels"
              >
                {stats?.activeChannels || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
