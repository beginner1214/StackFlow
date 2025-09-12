import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";

interface SidebarProps {
  activeSection: 'compose' | 'scheduled' | 'history';
  onSectionChange: (section: 'compose' | 'scheduled' | 'history') => void;
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { teamId, userId } = useAuth();

  const { data: stats } = useQuery<{
    messagesSent: number;
    scheduledMessages: number;
    activeChannels: number;
  }>({
    queryKey: ['/api/messages/stats', teamId, userId],
    enabled: !!(teamId && userId),
  });

  const { data: channels } = useQuery<Array<{
    id: string;
    name: string;
    isPrivate: boolean;
  }>>({
    queryKey: ['/api/slack/channels', teamId, userId],
    enabled: !!(teamId && userId),
  });

  const recentChannels = channels?.slice(0, 5) || [];

  return (
    <aside className="w-64 bg-card border-r border-border h-screen sticky top-0">
      <nav className="p-4 space-y-2">
        <button 
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'compose' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
          onClick={() => onSectionChange('compose')}
          data-testid="button-compose"
        >
          <i className="fas fa-edit"></i>
          <span>Compose Message</span>
        </button>
        <button 
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'scheduled' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
          onClick={() => onSectionChange('scheduled')}
          data-testid="button-scheduled"
        >
          <i className="fas fa-clock"></i>
          <span>Scheduled Messages</span>
          {(stats?.scheduledMessages || 0) > 0 && (
            <span className="ml-auto bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs" data-testid="text-scheduled-count">
              {stats?.scheduledMessages}
            </span>
          )}
        </button>
        <button 
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
            activeSection === 'history' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }`}
          onClick={() => onSectionChange('history')}
          data-testid="button-history"
        >
          <i className="fas fa-history"></i>
          <span>Message History</span>
        </button>
      </nav>
      
      <div className="p-4 border-t border-border mt-8">
        <h3 className="text-sm font-medium text-foreground mb-3">Recent Channels</h3>
        <div className="space-y-1">
          {recentChannels.length > 0 ? (
            recentChannels.map((channel: any) => (
              <div key={channel.id} className="flex items-center space-x-2 px-2 py-1 rounded text-sm text-muted-foreground hover:bg-accent cursor-pointer">
                <span className="text-green-500">{channel.isPrivate ? '🔒' : '#'}</span>
                <span data-testid={`text-channel-${channel.name}`}>{channel.name}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No recent channels</p>
          )}
        </div>
      </div>
    </aside>
  );
}
