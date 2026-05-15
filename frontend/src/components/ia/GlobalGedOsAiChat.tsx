import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { useServerAIContext } from '../../pages/DashboardViews/admin/hooks/useServerAIContext';
import { useMissionStats } from '../../pages/DashboardViews/admin/hooks/useMissionStats';
import GedOsAiChat from './MissionMentor/GedOsAiChat';

/**
 * 🌍 GLOBAL GED OS AI CHAT
 * Wraps the GedOsAiChat with all required context hooks to make it available everywhere.
 */
export const GlobalGedOsAiChat: React.FC = () => {
  const { user } = useAuth();
  const { project } = useProject();
  
  const projectId = project?.id || '';
  // Only enable context fetching if user is logged in
  const isEnabled = !!user && !!projectId;

  // ── HOOKS FROM ADMIN DASHBOARD ──
  const { stats } = useMissionStats(user as any, projectId);
  const { 
    households, 
    teams, 
    auditLogs, 
    regionalSummaries 
  } = useServerAIContext(projectId, isEnabled);

  if (!user) return null;

  return (
    <GedOsAiChat
      stats={stats}
      auditLogs={auditLogs}
      households={households}
      teams={teams}
      regionalSummaries={regionalSummaries}
    />
  );
};

export default GlobalGedOsAiChat;
