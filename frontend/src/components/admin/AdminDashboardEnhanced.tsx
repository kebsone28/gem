

/**
 * AdminDashboardEnhanced - Console d'Administration avec paramètres ajustables
 * Exemple d'implémentation avec ConsoleSettings et useConsoleLayout
 */

import React, { useState } from 'react';
import { ShieldCheck, Activity, Users, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ConsoleSettings, type ConsoleSettingsConfig } from './ConsoleSettings';
import { useConsoleLayout } from '../../hooks/useConsoleLayout';

const DEFAULT_SETTINGS: ConsoleSettingsConfig = {
  showSidebar: true,
  showStats: true,
  showTeams: true,
  showLogs: true,
  theme: 'dark',
  accentColor: 'blue',
  compact: false,
  columns: 3,
  gridSpacing: 'normal',
};

export const AdminDashboardEnhanced: React.FC = () => {
  const [settings, setSettings] = useState<ConsoleSettingsConfig>(DEFAULT_SETTINGS);
  const layout = useConsoleLayout(settings);

  // Données mockées pour la démo
  const kpiCards = [
    { icon: Activity, label: 'Ménages Électrifiés', value: '1,243', change: '+12%' },
    { icon: Users, label: 'Équipes Actives', value: '8', change: '+2' },
    { icon: AlertCircle, label: 'Alertes Critiques', value: '3', change: '↓ 1' },
  ];

  // Pré-calculs immuables pour éviter appels impurs au rendu
  const teamNames = React.useMemo(() => ['Alpha Squad', 'Beta Team', 'Gamma Unit'], []);
  // Deterministic metric based on name to avoid Math.random in render
  const teamMetrics = React.useMemo(() => {
    const hash = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
      return Math.abs(h);
    };
    return teamNames.map((n) => 70 + (hash(n) % 31));
  }, [teamNames]);
  const nowTime = React.useMemo(() => new Date().toLocaleTimeString(), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-slate-800 bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-xl sticky top-0 z-40"
      >
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <ShieldCheck className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">
                  CONSOLE D'ADMINISTRATION
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Système de pilotage stratégique Haute-Performance
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/50">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Expert Console V.2
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className={`max-w-7xl mx-auto ${layout.layoutConfig.padding}`}>
        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`mb-12 ${settings.compact ? 'mb-8' : ''}`}
        >
          <h2 className={`${settings.compact ? 'text-3xl' : 'text-5xl'} font-black text-white mb-2 tracking-tighter`}>
            PILOTAGE STRATÉGIQUE
          </h2>
          <div className="h-1 w-32 rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-transparent" />
        </motion.div>

        {/* KPI Cards Grid - Conditionally Rendered */}
        {settings.showStats && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`grid ${layout.layoutConfig.gridCols} ${layout.layoutConfig.spacing} mb-${settings.compact ? '8' : '12'}`}
          >
            {kpiCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  className={layout.getWidgetClasses()}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg bg-blue-500/20">
                      <Icon className="text-blue-400" size={20} />
                    </div>
                    <span className="text-xs font-bold text-green-400 bg-green-500/20 px-2 py-1 rounded">
                      {card.change}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mb-2">{card.label}</p>
                  <p className={`${settings.compact ? 'text-2xl' : 'text-3xl'} font-black text-white`}>
                    {card.value}
                  </p>
                </motion.div>
              );
            })}
          </motion.section>
        )}

        {/* Teams Section */}
        {settings.showTeams && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`mb-${settings.compact ? '8' : '12'}`}
          >
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users size={20} className="text-blue-400" />
              Performance des Équipes
            </h3>
            <div className={layout.getWidgetClasses()}>
              <div className="space-y-3">
                {teamNames.map((team, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <span className="text-slate-300 font-medium">{team}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full bg-slate-700">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                          style={{ '--progress': `${teamMetrics[i]}%` } as React.CSSProperties}
                        />
                      </div>
                      <span className="text-sm font-bold text-blue-400 w-10">
                        {Math.round(teamMetrics[i])}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* Logs Section */}
        {settings.showLogs && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-blue-400" />
              Logs & Événements Récents
            </h3>
            <div className={layout.getWidgetClasses()}>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {[
                  { type: 'success', msg: 'Sync Kobo complétée - 523 ménages' },
                  { type: 'warning', msg: 'Alerte: Rendement équipe Alpha < 1 ménage/jour' },
                  { type: 'info', msg: 'Nouveau PV créé - Household #4521' },
                  { type: 'success', msg: 'Budget reconciliation - Écart: 2.3%' },
                ].map((log, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded text-xs font-mono flex items-start gap-2 ${
                      log.type === 'success' ? 'bg-green-500/10 text-green-300' :
                      log.type === 'warning' ? 'bg-yellow-500/10 text-yellow-300' :
                      'bg-blue-500/10 text-blue-300'
                    }`}
                  >
                    <span className="mt-0.5">▸</span>
                    <span>[{nowTime}] {log.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </main>

      {/* Settings Panel - Always Visible */}
      <ConsoleSettings onSettingsChange={setSettings} />

      {/* Layout Info - Dev Mode */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 left-4 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 max-w-xs">
          <p className="font-bold text-white mb-1">Layout Info:</p>
          <p>Cols: {settings.columns} | Spacing: {settings.gridSpacing} | Compact: {settings.compact ? 'Yes' : 'No'}</p>
          <p>Grid: {layout.layoutConfig.gridCols}</p>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardEnhanced;
