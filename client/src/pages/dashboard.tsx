import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import Header from "../components/header";
import Sidebar from "../components/sidebar";
import ComposeSection from "../components/compose-section";
import ScheduledMessages from "../components/scheduled-messages";

type ActiveSection = 'compose' | 'scheduled' | 'history';

export default function Dashboard() {
  const { isConnected, isLoading } = useAuth();
  const [activeSection, setActiveSection] = useState<ActiveSection>('compose');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="bg-card rounded-lg border border-border p-8">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <i className="fab fa-slack text-primary-foreground text-2xl"></i>
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">Welcome to Slack Connect</h1>
            <p className="text-muted-foreground mb-6">
              Connect your Slack workspace to start sending and scheduling messages.
            </p>
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="flex-1 p-6">
          {activeSection === 'compose' && <ComposeSection />}
          {activeSection === 'scheduled' && <ScheduledMessages />}
          {activeSection === 'history' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-card rounded-lg border border-border p-6 text-center">
                <h2 className="text-lg font-semibold text-foreground mb-2">Message History</h2>
                <p className="text-muted-foreground">This feature is coming soon!</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ConnectButton() {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/slack/auth');
      const data = await response.json();
      
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      setIsConnecting(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
      data-testid="button-connect-slack"
    >
      {isConnecting ? (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Connecting...</span>
        </div>
      ) : (
        <>
          <i className="fab fa-slack mr-2"></i>
          Connect to Slack
        </>
      )}
    </button>
  );
}
