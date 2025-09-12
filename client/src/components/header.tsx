import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";

export default function Header() {
  const { teamName, disconnect } = useAuth();
  const { toast } = useToast();

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast({
        title: "Disconnected",
        description: "Successfully disconnected from Slack workspace",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect from Slack workspace",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <i className="fab fa-slack text-primary-foreground text-lg"></i>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Slack Connect</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-muted-foreground" data-testid="text-connection-status">
              Connected to {teamName}
            </span>
          </div>
          <button 
            onClick={handleDisconnect}
            className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            data-testid="button-disconnect"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>Disconnect
          </button>
        </div>
      </div>
    </header>
  );
}
