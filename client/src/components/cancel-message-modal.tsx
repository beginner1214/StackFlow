import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { format } from "date-fns";

interface ScheduledMessage {
  id: string;
  channel: string;
  channelName?: string;
  content: string;
  scheduledFor: string;
  timezone: string;
}

interface CancelMessageModalProps {
  message: ScheduledMessage | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export default function CancelMessageModal({ 
  message, 
  isOpen, 
  onClose, 
  onConfirm, 
  isLoading 
}: CancelMessageModalProps) {
  if (!message) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-destructive"></i>
            </div>
            <div>
              <DialogTitle>Cancel Scheduled Message</DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="bg-muted rounded-lg p-3 space-y-2">
          <p className="text-sm text-foreground">
            <strong>Channel:</strong> #{message.channelName || message.channel}
          </p>
          <p className="text-sm text-foreground">
            <strong>Message:</strong> {message.content.substring(0, 100)}
            {message.content.length > 100 ? '...' : ''}
          </p>
          <p className="text-sm text-foreground">
            <strong>Scheduled:</strong> {format(new Date(message.scheduledFor), 'MMM dd, yyyy')} at{' '}
            {format(new Date(message.scheduledFor), 'h:mm a')} {message.timezone}
          </p>
        </div>
        
        <DialogFooter className="space-x-2">
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
            data-testid="button-confirm-cancel"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Cancelling...</span>
              </div>
            ) : (
              <>
                <i className="fas fa-trash mr-2"></i>Cancel Message
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={isLoading} data-testid="button-keep-message">
            Keep Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
