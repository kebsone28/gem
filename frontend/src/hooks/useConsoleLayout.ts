/**
 * useConsoleLayout - Hook pour gérer le layout dynamique de la console
 * Applique les paramètres en temps réel au CSS et au layout
 */

import { useCallback, useEffect, useMemo } from 'react';

export interface ConsoleSettings {
  showSidebar: boolean;
  showStats: boolean;
  showTeams: boolean;
  showLogs: boolean;
  theme: 'dark' | 'light';
  accentColor: 'blue' | 'purple' | 'green' | 'red';
  compact: boolean;
  columns: 1 | 2 | 3;
  gridSpacing: 'tight' | 'normal' | 'spacious';
}

interface LayoutConfig {
  gridCols: string;
  spacing: string;
  padding: string;
  rowGap: string;
  fontSize: string;
}

export const useConsoleLayout = (settings: ConsoleSettings) => {
  // Calculer le layout config avec useMemo au lieu de useState
  const layoutConfig = useMemo<LayoutConfig>(
    () => ({
      gridCols: `grid-cols-${settings.columns}`,
      spacing: {
        tight: 'gap-3',
        normal: 'gap-6',
        spacious: 'gap-8',
      }[settings.gridSpacing],
      padding: settings.compact ? 'p-3' : 'p-6',
      rowGap: {
        tight: 'gap-y-3',
        normal: 'gap-y-6',
        spacious: 'gap-y-8',
      }[settings.gridSpacing],
      fontSize: settings.compact ? 'text-sm' : 'text-base',
    }),
    [settings.columns, settings.gridSpacing, settings.compact]
  );

  // Appliquer les variables CSS et le thème (side effects)
  useEffect(() => {
    const root = document.documentElement;
    const accentColors = {
      blue: 'rgb(59, 130, 246)',
      purple: 'rgb(147, 51, 234)',
      green: 'rgb(34, 197, 94)',
      red: 'rgb(239, 68, 68)',
    };

    root.style.setProperty('--accent-color', accentColors[settings.accentColor]);
    root.style.setProperty('--compact-mode', settings.compact ? '1' : '0');

    // Appliquer le thème (dark/light)
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.accentColor, settings.compact, settings.theme]);

  // Obtenir les classes dynamiques pour un widget
  const getWidgetClasses = useCallback(() => {
    return `
      rounded-xl 
      border border-slate-700 
      bg-gradient-to-br from-slate-900/50 to-slate-800/50 
      p-${settings.compact ? '3' : '6'} 
      backdrop-blur-sm
      transition-all duration-300
      hover:border-slate-600 hover:shadow-lg
    `.trim();
  }, [settings.compact]);

  return {
    layoutConfig,
    getWidgetClasses,
    isSidebarVisible: settings.showSidebar,
    showStats: settings.showStats,
    showTeams: settings.showTeams,
    showLogs: settings.showLogs,
    isCompact: settings.compact,
  };
};
