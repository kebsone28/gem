import React from 'react';
import GedOsAiChat from './MissionMentor/GedOsAiChat';
import { useServerAIContext } from '../../pages/DashboardViews/admin/hooks/useServerAIContext';

/**
 * GlobalGedOsAiChat - Wrapper global pour l'assistant IA
 */

interface GlobalGedOsAiChatProps {
  className?: string;
}

export const GlobalGedOsAiChat: React.FC<GlobalGedOsAiChatProps> = ({ className }) => {
  const { stats, auditLogs, households, teams, regionalSummaries } = useServerAIContext();

  return (
    <GedOsAiChat
      stats={stats}
      auditLogs={auditLogs}
      households={households}
      teams={teams}
      regionalSummaries={regionalSummaries}
      className={className || "bottom-4 right-4"}
    />
  );
};
