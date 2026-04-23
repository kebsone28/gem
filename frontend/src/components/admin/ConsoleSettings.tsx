 
/**
 * ConsoleSettings - Panneau d'ajustement pour la console d'administration
 * Permet de personnaliser l'affichage en temps réel
 */

import React, { useState, useEffect } from 'react';
import { Settings, X, Eye, Layout, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConsoleSettingsProps {
  onSettingsChange?: (settings: ConsoleSettingsConfig) => void;
}

export interface ConsoleSettingsConfig {
  // Affichage
  showSidebar: boolean;
  showStats: boolean;
  showTeams: boolean;
  showLogs: boolean;
  
  // Thème
  theme: 'dark' | 'light';
  accentColor: 'blue' | 'purple' | 'green' | 'red';
  compact: boolean;
  
  // Layout
  columns: 1 | 2 | 3;
  gridSpacing: 'tight' | 'normal' | 'spacious';
}

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

export const ConsoleSettings: React.FC<ConsoleSettingsProps> = ({ onSettingsChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<ConsoleSettingsConfig>(() => {
    // Charger depuis localStorage
    const saved = localStorage.getItem('console-settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Sauvegarder et notifier les changements
  useEffect(() => {
    localStorage.setItem('console-settings', JSON.stringify(settings));
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  const toggleSetting = (key: keyof ConsoleSettingsConfig) => {
    setSettings(prev => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key]
    }));
  };

  const updateSetting = (key: keyof ConsoleSettingsConfig, value: unknown) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    } as ConsoleSettingsConfig));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <>
      {/* Bouton Settings */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all z-40"
        title="Paramètres de la console"
      >
        <Settings size={20} />
      </button>

      {/* Modal Settings */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-end"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:w-96 bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-700 bg-slate-900/95">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings size={20} />
                  Paramètres Console
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  aria-label="Fermer"
                  title="Fermer"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Affichage Section */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">
                    <Eye size={16} /> Affichage
                  </h3>
                  <div className="space-y-2 pl-6 border-l border-slate-700">
                    {[
                      { key: 'showSidebar', label: 'Sidebar' },
                      { key: 'showStats', label: 'Statistiques KPI' },
                      { key: 'showTeams', label: 'Performance Équipes' },
                      { key: 'showLogs', label: 'Logs & Audit' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={settings[key as keyof ConsoleSettingsConfig] as boolean}
                          onChange={() => toggleSetting(key as keyof ConsoleSettingsConfig)}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Layout Section */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">
                    <Layout size={16} /> Mise en Page
                  </h3>
                  <div className="space-y-3 pl-6 border-l border-slate-700">
                    {/* Colonnes */}
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-wider">
                        Colonnes: {settings.columns}
                      </label>
                      <div className="flex gap-2 mt-2">
                        {[1, 2, 3].map(cols => (
                          <button
                            key={cols}
                            onClick={() => updateSetting('columns', cols as 1 | 2 | 3)}
                            className={`flex-1 py-2 px-3 rounded text-sm font-bold transition-all ${
                              settings.columns === cols
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {cols}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Espacement */}
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-wider">
                        Espacement: {settings.gridSpacing}
                      </label>
                      <div className="flex gap-2 mt-2">
                        {(['tight', 'normal', 'spacious'] as const).map(spacing => (
                          <button
                            key={spacing}
                            onClick={() => updateSetting('gridSpacing', spacing)}
                            className={`flex-1 py-2 px-2 rounded text-xs font-bold transition-all ${
                              settings.gridSpacing === spacing
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {spacing === 'tight' ? 'Serré' : spacing === 'normal' ? 'Normal' : 'Spacieux'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Compact Mode */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={settings.compact}
                        onChange={() => toggleSetting('compact')}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                        Mode Compact
                      </span>
                    </label>
                  </div>
                </div>

                {/* Thème Section */}
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-wider mb-3">
                    <Palette size={16} /> Thème & Couleurs
                  </h3>
                  <div className="space-y-3 pl-6 border-l border-slate-700">
                    {/* Couleur d'accent */}
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-wider">
                        Couleur d'Accent
                      </label>
                      <div className="flex gap-2 mt-2">
                        {['blue', 'purple', 'green', 'red'].map(color => (
                          <button
                            key={color}
                            onClick={() => updateSetting('accentColor', color)}
                            className={`w-8 h-8 rounded-lg transition-all ${
                              {
                                blue: 'bg-blue-500',
                                purple: 'bg-purple-500',
                                green: 'bg-green-500',
                                red: 'bg-red-500',
                              }[color]
                            } ${
                              settings.accentColor === color
                                ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white scale-110'
                                : 'opacity-60 hover:opacity-100'
                            }`}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-6 border-t border-slate-700">
                  <button
                    onClick={resetSettings}
                    className="flex-1 py-2 px-4 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-bold"
                  >
                    Réinitialiser
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-2 px-4 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-bold"
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
