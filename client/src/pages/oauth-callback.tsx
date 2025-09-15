import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function OAuthCallback() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state"); 

      const error = urlParams.get("error");

      if (error) {
        setError("OAuth authorization was denied or failed");
        return;
      }

      if (!code) {
        setError("No authorization code received");
        return;
      }

      // ADD THIS STATE CHECK
      if (!state) {
        setError("No state parameter received");
        return;
      }

      try {
        const response = await fetch("/api/slack/oauth/callback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code, state }), // INCLUDE STATE HERE
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "OAuth callback failed");
        }

        // Store team and user info in localStorage for the auth hook
        localStorage.setItem("slack_team_id", data.team.id);
        localStorage.setItem("slack_user_id", data.user.id);
        localStorage.setItem("slack_team_name", data.team.name);

        // Redirect to dashboard
        navigate("/");
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4">
          <div className="bg-card rounded-lg border border-border p-6 text-center">
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-exclamation-triangle text-destructive text-xl"></i>
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Connection Failed
            </h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              data-testid="button-back-home"
            >
              Go Back Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Connecting to Slack
        </h1>
        <p className="text-muted-foreground">
          Please wait while we complete the connection...
        </p>
      </div>
    </div>
  );
}
