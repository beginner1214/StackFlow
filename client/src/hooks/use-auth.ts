import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    const storedTeamId = localStorage.getItem('slack_team_id');
    const storedUserId = localStorage.getItem('slack_user_id');
    const storedTeamName = localStorage.getItem('slack_team_name');
    
    setTeamId(storedTeamId);
    setUserId(storedUserId);
    setTeamName(storedTeamName);
  }, []);

  const { data: status, isLoading } = useQuery<{
    connected: boolean;
    team?: { id: string; name: string };
    expired?: boolean;
  }>({
    queryKey: ['/api/slack/status', teamId, userId],
    enabled: !!(teamId && userId),
    refetchInterval: 30000, // Check status every 30 seconds
  });

  const disconnect = async () => {
    if (teamId && userId) {
      try {
        const response = await fetch(`/api/slack/disconnect/${teamId}/${userId}`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Failed to disconnect');
        }

        // Clear local storage
        localStorage.removeItem('slack_team_id');
        localStorage.removeItem('slack_user_id');
        localStorage.removeItem('slack_team_name');
        
        // Reset state
        setTeamId(null);
        setUserId(null);
        setTeamName(null);
      } catch (error) {
        console.error('Failed to disconnect:', error);
        throw error;
      }
    }
  };

  return {
    teamId,
    userId,
    teamName: status?.team?.name || teamName,
    isConnected: !!(teamId && userId && status?.connected),
    isLoading: !!(teamId && userId && isLoading),
    disconnect,
  };
}
