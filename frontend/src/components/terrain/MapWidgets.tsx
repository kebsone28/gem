import React, { useState } from 'react';
import { Activity, Search, Sun, Moon, Settings, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import './MapWidgets.css';

interface WidgetBarProps {
  activeWidgets: {
    unified: boolean;
    tools: boolean;
    search: boolean;
    legend: boolean;
  };
  onToggleWidget: (id: string) => void;
}

export const WidgetBar: React.FC<WidgetBarProps> = ({ activeWidgets, onToggleWidget }) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1">
      <div
        className={`p-0.5 rounded-xl border shadow-2xl flex items-center gap-0.5 map-widget-glass ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}
      >
        <button
          onClick={() => onToggleWidget('unified')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            activeWidgets.unified
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity size={12} />
          Tableau de Bord
        </button>
        <button
          onClick={() => onToggleWidget('tools')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            activeWidgets.tools
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings size={12} />
          Outils
        </button>
        <button
          onClick={() => onToggleWidget('search')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            activeWidgets.search
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Search size={12} />
          Recherche
        </button>

        <button
          onClick={() => onToggleWidget('legend')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
            activeWidgets.legend
              ? 'bg-primary text-white shadow-lg shadow-primary/30'
              : isDarkMode
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Info size={12} />
          Légende
        </button>

        <div className={`w-px h-3 mx-1 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

        <button
          onClick={toggleTheme}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${isDarkMode ? 'text-blue-400 hover:bg-blue-400/10' : 'text-primary hover:bg-primary/10'}`}
          title={isDarkMode ? 'Passer au mode clair' : 'Passer au mode sombre'}
        >
          {isDarkMode ? <Sun size={12} /> : <Moon size={12} />}
          <span className="hidden lg:inline">{isDarkMode ? 'Clair' : 'Sombre'}</span>
        </button>
      </div>
    </div>
  );
};

interface UnifiedStatusWidgetProps {
  selectedPhases: string[];
  onTogglePhase: (phase: string) => void;
  selectedTeamFilters: string[];
  onToggleTeamFilter: (team: string) => void;
  stats: {
    total: number;
    enCours: number;
    termine: number;
    bloque: number;
    teamProgress: {
      livraison: number;
      maconnerie: number;
      reseau: number;
      installation: number;
      controle: number;
    };
  } | null;
}

export const UnifiedStatusWidget: React.FC<UnifiedStatusWidgetProps> = ({
  selectedPhases,
  onTogglePhase,
  selectedTeamFilters,
  onToggleTeamFilter,
  stats,
}) => {
  const { isDarkMode } = useTheme();
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'phases' | 'stats' | 'teams'>('phases');

  const phases = [
    { label: 'Tout sélectionner', color: 'bg-indigo-500', value: 'all' },
    { label: 'Non encore installée', color: 'bg-slate-500', value: 'Non encore installée' },
    { label: 'Éligible', color: 'bg-blue-500', value: 'Eligible' },
    { label: 'En attente', color: 'bg-slate-400', value: 'En attente' },
    { label: 'Livraison', color: 'bg-emerald-600', value: 'Livraison effectuée' },
    { label: 'Murs', color: 'bg-amber-500', value: 'Murs terminés' },
    { label: 'Réseau', color: 'bg-cyan-500', value: 'Réseau terminé' },
    { label: 'Intérieur', color: 'bg-indigo-500', value: 'Intérieur terminé' },
    { label: 'Conforme ✓', color: 'bg-emerald-500', value: 'Contrôle conforme' },
    { label: 'Non conforme', color: 'bg-rose-500', value: 'Non conforme' },
    { label: 'Non éligible', color: 'bg-slate-500', value: 'Non éligible' },
    { label: 'Désistement', color: 'bg-slate-500', value: 'Désistement' },
    { label: 'Refusé', color: 'bg-rose-500', value: 'Refusé' },
  ];


  const isPhaseSelected = (value: string) => {
    if (value === 'all') return selectedPhases.length === (phases.length - 1); // phases includes 'all' item
    return selectedPhases.includes(value);
  };


  const teamRows = [
    {
      id: 'livraison',
      label: 'Livreur',
      progress: stats?.teamProgress.livraison || 0,
      color: 'bg-blue-300',
    },
    {
      id: 'maconnerie',
      label: 'Maçon',
      progress: stats?.teamProgress.maconnerie || 0,
      color: 'bg-blue-400',
    },
    {
      id: 'reseau',
      label: 'Réseau',
      progress: stats?.teamProgress.reseau || 0,
      color: 'bg-primary',
    },
    {
      id: 'installation',
      label: 'Installateur',
      progress: stats?.teamProgress.installation || 0,
      color: 'bg-emerald-400',
    },
    {
      id: 'controle',
      label: 'Contrôleur',
      progress: stats?.teamProgress.controle || 0,
      color: 'bg-emerald-500',
    },
  ];

  return (
    <motion.div
      drag
      dragMomentum={false}
      className={`absolute bottom-32 left-4 md:left-8 z-[1000] w-[calc(100%-2rem)] md:w-72 rounded-2xl border shadow-2xl overflow-hidden transition-colors map-widget-glass ${isDarkMode ? 'border-primary/20' : 'border-slate-200'}`}
    >
      <div className="p-4 flex items-center justify-between cursor-grab active:cursor-grabbing bg-electric-gradient">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-white" />
          <span className="text-xs font-black text-white italic uppercase tracking-widest">
            Suivi Opérationnel
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="drag-handle-dots flex items-center gap-0.5">
            <div className="w-0.5 h-0.5 bg-white dark:bg-slate-900 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-white dark:bg-slate-900 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-white dark:bg-slate-900 rounded-full"></div>
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white/50 hover:text-white transition-colors"
          >
            {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col"
          >
            {/* Tabs */}
            <div
              className={`flex border-b transition-colors ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}
            >
              {[
                { id: 'phases', label: 'Filtres' },
                { id: 'stats', label: 'KPIs' },
                { id: 'teams', label: 'Équipes' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${
                    activeTab === tab.id
                      ? 'text-primary bg-primary/5'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-[20%] right-[20%] h-0.5 bg-primary rounded-full shadow-[0_0_10px_rgba(30,144,255,0.5)]" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto max-h-[350px] widget-content-scroll">
              {activeTab === 'phases' && (
                <div className="space-y-2">
                  {phases.map((phase, i) => {
                    const active = isPhaseSelected(phase.value);
                    return (
                      <div
                        key={i}
                        onClick={() => onTogglePhase(phase.value)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border map-widget-item transition-all cursor-pointer ${active ? (isDarkMode ? 'bg-primary/20 border-primary/50 text-white shadow-xl shadow-slate-950/20' : 'bg-primary/5 border-primary/20 text-primary font-bold shadow-sm shadow-primary/10') : isDarkMode ? 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${phase.color}`} />
                          <span className="text-xs tracking-tight">{phase.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          title={`Filtrer par ${phase.label}`}
                          checked={active}
                          readOnly
                          className="rounded text-indigo-500 focus:ring-0 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total', value: stats?.total || 0, color: 'text-slate-500' },
                      { label: 'Conformes', value: stats?.termine || 0, color: 'text-emerald-500' },
                      { label: 'En cours', value: stats?.enCours || 0, color: 'text-blue-500' },
                      { label: 'Bloqués', value: stats?.bloque || 0, color: 'text-red-500' },
                    ].map((s, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                      >
                        <p className="text-xs font-black uppercase opacity-50 mb-1">{s.label}</p>
                        <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div
                    className={`pt-4 border-t transition-colors ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}
                  >
                    <div className="flex justify-between text-xs mb-2 font-black uppercase italic">
                      <span className="text-slate-500">Progression Globale</span>
                      <span className="text-indigo-600">
                        {stats?.total ? Math.round((stats.termine / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div
                      className={`h-1.5 w-full rounded-full overflow-hidden transition-colors ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
                    >
                      <div
                        className={`h-full bg-primary rounded-full transition-all duration-1000 dynamic-progress-bar`}
                        data-progress={`${stats?.total ? (stats.termine / stats.total) * 100 : 0}`}
                        ref={(el) => {
                          if (el)
                            el.style.setProperty(
                              '--progress-width',
                              `${stats?.total ? (stats.termine / stats.total) * 100 : 0}%`
                            );
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'teams' && (
                <div className="space-y-5">
                  {teamRows.map((team, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-black uppercase">
                        <div
                          onClick={() => onToggleTeamFilter(team.id)}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            title={`Afficher/Masquer ${team.label}`}
                            checked={selectedTeamFilters.includes(team.id)}
                            readOnly
                            className="rounded text-indigo-600 focus:ring-0 cursor-pointer w-3 h-3"
                          />
                          <span
                            className={`${selectedTeamFilters.includes(team.id) ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}
                          >
                            {team.label}
                          </span>
                        </div>
                        <span className="text-indigo-600">{team.progress}%</span>
                      </div>
                      <div
                        className={`h-1.5 w-full rounded-full overflow-hidden transition-colors ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${team.progress}%` }}
                          className={`h-full rounded-full transition-opacity ${selectedTeamFilters.includes(team.id) ? 'opacity-100' : 'opacity-20'} ${team.color}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
