import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { useServerAIContext } from '../../pages/DashboardViews/admin/hooks/useServerAIContext';
import { useMissionStats } from '../../pages/DashboardViews/admin/hooks/useMissionStats';
import { MissionMentor } from './MissionMentor';

/**
 * 🌍 GLOBAL MISSION MENTOR
 * Wraps the MissionMentor with all required context hooks to make it available everywhere.
 */
export const GlobalMissionMentor: React.FC = () => {
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
    <MissionMentor
      stats={stats}
      auditLogs={auditLogs}
      households={households}
      teams={teams}
      regionalSummaries={regionalSummaries}
    />
  );
};

export default GlobalMissionMentor;
