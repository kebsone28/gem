/**
 * 🧠 AIContext - Contexte global pour l'état de l'IA
 * Centralise l'état et les actions liées au mentor IA
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { AIResponse, RegionalSummary } from '../../services/ai/MissionSageService';
import type { MissionStats } from '../../services/missionStatsService';
import type { AuditLog, Household, Team } from '../../utils/types';

interface AIState {
  history: AIResponse[];
  query: string;
  isThinking: boolean;
  isListening: boolean;
  isMuted: boolean;
  isOpen: boolean;
  isMaximized: boolean;
  isAdminPanelOpen: boolean;
  isTrainingStudioOpen: boolean;
}

interface AIActions {
  setQuery: (query: string) => void;
  setIsOpen: (open: boolean) => void;
  setIsMaximized: (maximized: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setIsAdminPanelOpen: (open: boolean) => void;
  setIsTrainingStudioOpen: (open: boolean) => void;
  addToHistory: (response: AIResponse) => void;
  clearHistory: () => void;
  setThinking: (thinking: boolean) => void;
  setListening: (listening: boolean) => void;
}

interface AIContextValue extends AIState, AIActions {
  aiState: {
    stats: MissionStats | null;
    auditLogs: AuditLog[];
    households: Household[];
    teams: Team[];
    regionalSummaries: RegionalSummary[];
  };
}

const AIContext = createContext<AIContextValue | undefined>(undefined);

interface AIProviderProps {
  children: ReactNode;
  stats: MissionStats | null;
  auditLogs: AuditLog[];
  households: Household[];
  teams: Team[];
  regionalSummaries: RegionalSummary[];
}

export function AIProvider({
  children,
  stats,
  auditLogs,
  households,
  teams,
  regionalSummaries,
}: AIProviderProps) {
  const [history, setHistory] = useState<AIResponse[]>([]);
  const [query, setQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isTrainingStudioOpen, setIsTrainingStudioOpen] = useState(false);

  const aiState = useMemo(
    () => ({
      stats,
      auditLogs,
      households,
      teams,
      regionalSummaries,
    }),
    [stats, auditLogs, households, teams, regionalSummaries]
  );

  const addToHistory = useCallback((response: AIResponse) => {
    setHistory((prev) => [...prev, response]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const setThinking = useCallback((thinking: boolean) => {
    setIsThinking(thinking);
  }, []);

  const setListening = useCallback((listening: boolean) => {
    setIsListening(listening);
  }, []);

  const value: AIContextValue = useMemo(
    () => ({
      history,
      query,
      isThinking,
      isListening,
      isMuted,
      isOpen,
      isMaximized,
      isAdminPanelOpen,
      isTrainingStudioOpen,
      aiState,
      setQuery,
      setIsOpen,
      setIsMaximized,
      setIsMuted,
      setIsAdminPanelOpen,
      setIsTrainingStudioOpen,
      addToHistory,
      clearHistory,
      setThinking,
      setListening,
    }),
    [
      history,
      query,
      isThinking,
      isListening,
      isMuted,
      isOpen,
      isMaximized,
      isAdminPanelOpen,
      isTrainingStudioOpen,
      aiState,
      addToHistory,
      clearHistory,
      setThinking,
      setListening,
    ]
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAIContext(): AIContextValue {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAIContext must be used within an AIProvider');
  }
  return context;
}
