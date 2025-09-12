import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { apiRequest, queryClient } from "../lib/queryClient";
import CancelMessageModal from "./cancel-message-modal";
import { Button } from "./ui/button";
import { format } from "date-fns";

interface ScheduledMessage {
  id: string;
  channel: string;
  channelName?: string;
  content: string;
  scheduledFor: string;
  timezone: string;
  status: string;
  createdAt: string;
}

export default function ScheduledMessages() {
  const { teamId, userId } = useAuth();
  const { toast } = useToast();
  const [messageToCancel, setMessageToCancel] = useState<ScheduledMessage | null>(null);

  const { data: messages, isLoading } = useQuery<ScheduledMessage[]>({
    queryKey: ['/api/messages/scheduled', teamId, userId],
    enabled: !!(teamId && userId),
  });

  const cancelMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest('DELETE', `/api/messages/scheduled/${teamId}/${userId}/${messageId}`);
    },
    onSuccess: () => {
      toast({
        title: "Message Cancelled",
        description: "The scheduled message has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/scheduled', teamId, userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/stats', teamId, userId] });
      setMessageToCancel(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to Cancel",
        description: error instanceof Error ? error.message : "Failed to cancel message",
        variant: "destructive",
      });
    },
  });

  const handleCancelMessage = (message: ScheduledMessage) => {
    setMessageToCancel(message);
  };

  const confirmCancel = () => {
    if (messageToCancel) {
      cancelMutation.mutate(messageToCancel.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'sending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'fas fa-clock';
      case 'sending':
        return 'fas fa-paper-plane';
      case 'sent':
        return 'fas fa-check';
      case 'failed':
        return 'fas fa-exclamation-triangle';
      case 'cancelled':
        return 'fas fa-ban';
      default:
        return 'fas fa-question';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-card rounded-lg border border-border p-6 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading scheduled messages...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-card rounded-lg border border-border">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Scheduled Messages</h2>
              <div className="flex items-center space-x-2">
                <Button variant="secondary" size="sm">
                  <i className="fas fa-filter mr-1"></i>Filter
                </Button>
                <Button variant="secondary" size="sm">
                  <i className="fas fa-download mr-1"></i>Export
                </Button>
              </div>
            </div>
          </div>
          
          {!messages || messages.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-clock text-muted-foreground text-2xl"></i>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No Scheduled Messages</h3>
              <p className="text-muted-foreground">You haven't scheduled any messages yet.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Channel</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Message Preview</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Scheduled For</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((message: ScheduledMessage) => (
                      <tr key={message.id} className="border-b border-border hover:bg-muted/30">
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-green-500">#</span>
                            <span className="font-medium" data-testid={`text-channel-${message.id}`}>
                              {message.channelName || message.channel}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="max-w-xs">
                            <p className="text-sm text-foreground truncate" data-testid={`text-content-${message.id}`}>
                              {message.content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {message.content.length} characters
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm">
                            <p className="text-foreground" data-testid={`text-date-${message.id}`}>
                              {format(new Date(message.scheduledFor), 'MMM dd, yyyy')}
                            </p>
                            <p className="text-muted-foreground" data-testid={`text-time-${message.id}`}>
                              {format(new Date(message.scheduledFor), 'h:mm a')} {message.timezone}
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(message.status)}`}>
                            <i className={`${getStatusIcon(message.status)} mr-1`}></i>
                            {message.status.charAt(0).toUpperCase() + message.status.slice(1)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            {message.status === 'pending' && (
                              <button 
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors" 
                                onClick={() => handleCancelMessage(message)}
                                title="Cancel"
                                data-testid={`button-cancel-${message.id}`}
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 border-t border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground" data-testid="text-message-count">
                    Showing {messages.length} scheduled message{messages.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <CancelMessageModal
        message={messageToCancel}
        isOpen={!!messageToCancel}
        onClose={() => setMessageToCancel(null)}
        onConfirm={confirmCancel}
        isLoading={cancelMutation.isPending}
      />
    </>
  );
}
