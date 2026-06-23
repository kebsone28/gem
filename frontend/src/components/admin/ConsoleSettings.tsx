
/**
 * ConsoleSettings - Panneau d'ajustement Ultra-Complet
 * Avec descriptions explicatives pour chaque option
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Eye, 
  Layout, 
  Palette, 
  PanelLeft, 
  BarChart3, 
  Users2, 
  History, 
  Bot,
  RefreshCw,
  Volume2,
  Sparkles,
  Moon,
  GripVertical,
  Bell,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SortableWidgetList } from '@modules/dashboard/widgets/SortableWidgetList';
import { loadWidgetOrder, saveWidgetOrder, type WidgetItem } from '@modules/dashboard/widgets/widgetStore';

interface ConsoleSettingsProps {
  onSettingsChange?: (settings: ConsoleSettingsConfig) => void;
  onClose?: () => void;
  showButton?: boolean;
}

export interface ConsoleSettingsConfig {
  showSidebar: boolean;
  showStats: boolean;
  showTeams: boolean;
  showLogs: boolean;
  showAI: boolean;
  autoRefresh: boolean;
  soundEnabled: boolean;
  browserNotifications: boolean;
  missionNotifications: boolean;
  animationsEnabled: boolean;
  theme: 'dark' | 'light';
  accentColor: 'blue' | 'purple' | 'green' | 'red';
  glassEffect: 'low' | 'high';
  compact: boolean;
  columns: 1 | 2 | 3;
}

const DEFAULT_SETTINGS: ConsoleSettingsConfig = {
  showSidebar: true,
  showStats: true,
  showTeams: true,
  showLogs: true,
  showAI: true,
  autoRefresh: true,
  soundEnabled: true,
  browserNotifications: true,
  missionNotifications: true,
  animationsEnabled: true,
  theme: 'dark',
  accentColor: 'blue',
  glassEffect: 'high',
  compact: false,
  columns: 3,
};

export const ConsoleSettings: React.FC<ConsoleSettingsProps> = ({ onSettingsChange, onClose, showButton = false }) => {
  const [isOpen, setIsOpen] = useState(!showButton);
  const [settings, setSettings] = useState<ConsoleSettingsConfig>(() => {
    const saved = localStorage.getItem('console-settings');
    try {
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [widgetOrder, setWidgetOrder] = useState<WidgetItem[]>(loadWidgetOrder);

  useEffect(() => {
    localStorage.setItem('console-settings', JSON.stringify(settings));
    onSettingsChange?.(settings);
    window.dispatchEvent(new CustomEvent('ged-os:console-settings-change', { detail: settings }));
    
    const colorMap = { blue: '#3b82f6', purple: '#a855f7', green: '#10b981', red: '#ef4444' };
    const root = document.documentElement;
    root.style.setProperty('--accent-color', colorMap[settings.accentColor]);
    
    let styleTag = document.getElementById('ged-os-dynamic-theme');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'ged-os-dynamic-theme';
      document.head.appendChild(styleTag);
    }
    
    styleTag.innerHTML = `
      :root {
        --accent-color: ${colorMap[settings.accentColor]};
        --glass-opacity: ${settings.glassEffect === 'high' ? '0.8' : '0.4'};
      }
      ${!settings.animationsEnabled ? `* { transition: none !important; animation: none !important; }` : ''}
      .text-accent { color: ${colorMap[settings.accentColor]} !important; }
      .bg-accent { background-color: ${colorMap[settings.accentColor]} !important; }
      .border-accent { border-color: ${colorMap[settings.accentColor]} !important; }
    `;
  }, [settings, onSettingsChange]);

  const toggleSetting = (key: keyof ConsoleSettingsConfig) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateSetting = (key: keyof ConsoleSettingsConfig, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const accentClasses = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100]" 
              onClick={() => { setIsOpen(false); onClose?.(); }} 
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[400px] bg-[#070b18] z-[101] shadow-2xl flex flex-col border-l border-white/5"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">Console Admin</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Édition de l'Expérience GEM OS</p>
                </div>
                <button onClick={() => { setIsOpen(false); onClose?.(); }} className="p-2 text-slate-400 hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
                
                {/* 👁️ VISIBILITÉ */}
                <section>
                  <SectionTitle icon={Eye} color="text-blue-400">Affichage & Navigation</SectionTitle>
                  <div className="space-y-4">
                    {[
                      { key: 'showSidebar', label: 'Sidebar (Mode Rail)', desc: 'Réduit la barre gauche aux icônes pour gagner de l\'espace.', icon: PanelLeft },
                      { key: 'showStats', label: 'Statistiques KPI', desc: 'Affiche les graphiques et compteurs de progression.', icon: BarChart3 },
                      { key: 'showTeams', label: 'Équipes Terrain', desc: 'Affiche le tableau de performance des équipes.', icon: Users2 },
                      { key: 'showLogs', label: 'Journal d\'Audit', desc: 'Affiche le flux d\'activité et les logs système.', icon: History },
                      { key: 'showAI', label: 'Assistant IA (GAM AI)', desc: 'Active l\'assistant conversationnel sur le dashboard.', icon: Bot },
                    ].map((item) => (
                      <div 
                        key={item.key}
                        onClick={() => toggleSetting(item.key as any)}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06] transition-all group"
                      >
                        <div className="flex items-center gap-4 flex-1 pr-4">
                          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0">
                            <item.icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-200">{item.label}</div>
                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5 group-hover:text-slate-400 transition-colors">{item.desc}</div>
                          </div>
                        </div>
                        <div className={`w-11 h-5 rounded-full relative transition-all shrink-0 ${settings[item.key as keyof ConsoleSettingsConfig] ? accentClasses[settings.accentColor] : 'bg-slate-700'}`}>
                          <motion.div 
                            animate={{ x: settings[item.key as keyof ConsoleSettingsConfig] ? 24 : 2 }}
                            className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-lg" 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ⚙️ FONCTIONNALITÉS */}
                <section>
                  <SectionTitle icon={Layout} color="text-purple-400">Système & Performances</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'autoRefresh', label: 'Auto-Refresh', desc: 'Mise à jour auto', icon: RefreshCw },
                      { key: 'soundEnabled', label: 'Sons Système', desc: 'Alertes audio', icon: Volume2 },
                      { key: 'animationsEnabled', label: 'Animations', desc: 'Transitions fluides', icon: Sparkles },
                      { key: 'compact', label: 'Mode Compact', desc: 'Interface dense', icon: Moon },
                    ].map((item) => (
                      <button 
                        key={item.key}
                        onClick={() => toggleSetting(item.key as any)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center ${
                          settings[item.key as keyof ConsoleSettingsConfig]
                            ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
                            : 'bg-white/[0.02] border-white/5 text-slate-500'
                        }`}
                      >
                        <item.icon size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                        <span className="text-[8px] opacity-60 font-bold uppercase">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* 🔔 NOTIFICATIONS */}
                <section>
                  <SectionTitle icon={Bell} color="text-rose-400">Notifications</SectionTitle>
                  <div className="space-y-4">
                    {[
                      { key: 'soundEnabled', label: 'Sons', desc: 'Son de notification à chaque alerte', icon: Volume2 },
                      { key: 'browserNotifications', label: 'Notifications Bureau', desc: 'Envoyer des notifications Windows/macOS', icon: Zap },
                      { key: 'missionNotifications', label: 'Alertes Missions', desc: 'Notifications pour les approbations et rejets', icon: ShieldCheck },
                    ].map((item) => (
                      <div
                        key={item.key}
                        onClick={() => toggleSetting(item.key as any)}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.06] transition-all group"
                      >
                        <div className="flex items-center gap-4 flex-1 pr-4">
                          <div className="p-2.5 rounded-xl bg-slate-800 text-slate-400 group-hover:text-rose-400 transition-colors shrink-0">
                            <item.icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-200">{item.label}</div>
                            <div className="text-[10px] text-slate-500 leading-tight mt-0.5 group-hover:text-slate-400 transition-colors">{item.desc}</div>
                          </div>
                        </div>
                        <div className={`w-11 h-5 rounded-full relative transition-all shrink-0 ${settings[item.key as keyof ConsoleSettingsConfig] ? accentClasses[settings.accentColor] : 'bg-slate-700'}`}>
                          <motion.div animate={{ x: settings[item.key as keyof ConsoleSettingsConfig] ? 24 : 2 }} className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 🔄 ORDRE DES WIDGETS */}
                <section>
                  <SectionTitle icon={GripVertical} color="text-amber-400">Ordre des Widgets</SectionTitle>
                  <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">Faites glisser les sections du dashboard pour réorganiser leur affichage.</p>
                  <SortableWidgetList items={widgetOrder} onReorder={(items) => { setWidgetOrder(items); saveWidgetOrder(items); }} />
                </section>

                {/* 🎨 STYLE */}
                <section>
                  <SectionTitle icon={Palette} color="text-emerald-400">Thème & Identité Visuelle</SectionTitle>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                      {['blue', 'purple', 'green', 'red'].map(color => (
                        <button
                          key={color}
                          onClick={() => updateSetting('accentColor', color)}
                          className={`w-12 h-12 rounded-2xl transition-all ${accentClasses[color as keyof typeof accentClasses]} ${settings.accentColor === color ? 'ring-4 ring-white/30 scale-110 shadow-xl' : 'opacity-30 hover:opacity-100 hover:scale-105'}`}
                        />
                      ))}
                    </div>
                    <div className="flex gap-3">
                      {[
                        { id: 'low', label: 'Verre Discret', desc: 'Style minimaliste' },
                        { id: 'high', label: 'Verre Givré', desc: 'Effet Premium' }
                      ].map(val => (
                        <button
                          key={val.id}
                          onClick={() => updateSetting('glassEffect', val.id)}
                          className={`flex-1 p-4 rounded-2xl transition-all text-center border ${
                            settings.glassEffect === val.id 
                              ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg' 
                              : 'bg-white/[0.02] text-slate-500 border-white/5'
                          }`}
                        >
                          <div className="text-[10px] font-black uppercase tracking-widest">{val.label}</div>
                          <div className="text-[8px] opacity-80 uppercase mt-0.5">{val.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-white/5 bg-white/[0.01] flex gap-4">
                <button onClick={() => { localStorage.removeItem('console-settings'); window.location.reload(); }} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Réinitialiser</button>
                <button onClick={() => { setIsOpen(false); onClose?.(); }} className={`flex-[2] py-4 rounded-2xl text-white font-black uppercase tracking-widest text-[11px] shadow-2xl transition-all hover:scale-[1.02] ${accentClasses[settings.accentColor]}`}>Sauvegarder</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

const SectionTitle = ({ icon: Icon, children, color }: { icon: React.ComponentType<{ size?: number }>; children: React.ReactNode; color: string }) => (
  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${color}`}>
    <Icon size={14} /> {children}
  </h3>
);
