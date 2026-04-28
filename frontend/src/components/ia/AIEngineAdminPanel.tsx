/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 🎛️ AIEngineAdminPanel — Panneau de configuration des moteurs IA
 * Réservé à l'Admin PROQUELEC (ADMIN_PROQUELEC / admingem)
 */

import { useState } from 'react';
import {
  getAIEngineConfig,
  saveAIEngineConfig,
  resetAIEngineConfig,
  getModeLabelFR,
  getModeDescriptionFR,
  isClaudeEnabled,
  isRulesEnabled,
  type AIEngineMode,
  type AIEngineSettings,
} from '../../services/ai/AIEngineConfig';

interface Props {
  user: { role: string; email: string; displayName?: string };
  onClose: () => void;
}

const MODES: AIEngineMode[] = [
  'RULES_ONLY',
  'HYBRID_RULES_FIRST',
  'HYBRID_AI_FIRST',
  'CLAUDE_ONLY',
];

const MODE_ICONS: Record<AIEngineMode, string> = {
  RULES_ONLY: '⚙️',
  HYBRID_RULES_FIRST: '🔀',
  HYBRID_AI_FIRST: '🤖',
  CLAUDE_ONLY: '✨',
};

const MODE_COLORS: Record<AIEngineMode, string> = {
  RULES_ONLY: 'border-blue-500 bg-blue-900/20',
  HYBRID_RULES_FIRST: 'border-green-500 bg-green-900/20',
  HYBRID_AI_FIRST: 'border-purple-500 bg-purple-900/20',
  CLAUDE_ONLY: 'border-orange-500 bg-orange-900/20',
};

export default function AIEngineAdminPanel({ user, onClose }: Props) {
  const isMaster = user.role === 'ADMIN_PROQUELEC' || user.email === 'admingem';

  const [config, setConfig] = useState<AIEngineSettings>(getAIEngineConfig());
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  if (!isMaster) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-8 text-center max-w-sm">
          <p className="text-3xl mb-4">🔒</p>
          <h2 className="text-xl font-bold text-white mb-2">Accès restreint</h2>
          <p className="text-gray-400 text-sm mb-6">
            Cette console de configuration est réservée à l'Administrateur du bastion.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-red-600/20 text-red-400 rounded-xl font-semibold border border-red-900/50 hover:bg-red-600/30 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  function update(patch: Partial<AIEngineSettings>) {
    setConfig((c) => ({ ...c, ...patch }));
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    saveAIEngineConfig(config, user.email);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset() {
    if (!confirm('Réinitialiser la configuration aux valeurs par défaut ?')) return;
    const defaults = resetAIEngineConfig(user.email);
    setConfig(defaults);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const claudeActive = isClaudeEnabled(config);
  const rulesActive = isRulesEnabled(config);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-gray-950 border border-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col scale-in-center">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-gray-900/50 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="p-2 bg-blue-600/10 rounded-lg text-blue-400">⚙️</span>
              Configuration Moteur IA
            </h2>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold">
              GEM-MINT v8.0 Dual-Engine
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-all"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
          <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
              Backend Securise
            </p>
            <p className="mt-2 text-sm leading-relaxed text-cyan-50">
              Les fournisseurs IA, les secrets API et les appels Vision/Claude sont désormais
              gérés côté serveur. Cette console pilote seulement le mode d’orchestration local du
              mentor et sa mémoire de conversation.
            </p>
          </section>

          {/* Mode Selection */}
          <section>
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">
              Moteur Actif
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => update({ mode })}
                  className={`text-left p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group ${
                    config.mode === mode
                      ? MODE_COLORS[mode] + ' ring-2 ring-blue-500/20'
                      : 'border-gray-800 bg-gray-900/50 hover:bg-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2 relative z-10">
                    <span className="text-2xl group-hover:scale-110 transition-transform">
                      {MODE_ICONS[mode]}
                    </span>
                    <div>
                      <p
                        className={`font-bold text-sm ${config.mode === mode ? 'text-white' : 'text-gray-400'}`}
                      >
                        {getModeLabelFR(mode)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed relative z-10">
                    {getModeDescriptionFR(mode)}
                  </p>
                  {config.mode === mode && (
                    <div className="absolute top-0 right-0 p-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Status Indicators */}
          <section className="flex gap-3">
            <div
              className={`flex-1 rounded-xl p-4 text-center border transition-all ${rulesActive ? 'bg-blue-600/5 border-blue-500/30' : 'bg-gray-900/50 border-gray-800 grayscale opacity-50'}`}
            >
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter mb-1">
                Règles Métier
              </p>
              <p className="text-xs font-medium text-white">
                {rulesActive ? '✅ OPÉRATIONNEL' : '⭕ HORS-LIGNE'}
              </p>
            </div>
            <div
              className={`flex-1 rounded-xl p-4 text-center border transition-all ${claudeActive ? 'bg-purple-600/5 border-purple-500/30' : 'bg-gray-900/50 border-gray-800 grayscale opacity-50'}`}
            >
              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-tighter mb-1">
                AI Claude (API)
              </p>
              <p className="text-xs font-medium text-white">
                {claudeActive ? '✅ CONNECTÉ' : '⭕ DÉSACTIVÉ'}
              </p>
            </div>
          </section>

          {/* IA Source Selection */}
          <section>
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">
              Fournisseur IA
            </h3>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
              <p className="text-sm font-bold text-white">Géré côté serveur</p>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">
                Le mentor n’utilise plus la clé API, le fournisseur ou le timeout stockés dans ce
                navigateur. La source réelle est maintenant définie sur le backend via les variables
                d’environnement et les endpoints sécurisés.
              </p>
            </div>
          </section>

          {/* Advanced Settings */}
          {claudeActive && (
            <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest">
                Contexte Local du Mentor
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    key: 'enableConversationMemory',
                    label: 'Mémoire contextuelle',
                    desc: 'Le mentor conserve localement les derniers échanges pour contextualiser la session.',
                  },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-800 rounded-2xl cursor-pointer hover:border-gray-700 transition-all"
                  >
                    <div className="pr-4">
                      <p className="text-sm text-gray-200 font-bold">{opt.label}</p>
                      <p className="text-[10px] text-gray-500">{opt.desc}</p>
                    </div>
                    <div
                      className={`w-12 h-6 rounded-full transition-all relative ${config[opt.key as keyof AIEngineSettings] ? 'bg-purple-600 shadow-[0_0_12px_rgba(147,51,234,0.4)]' : 'bg-gray-800'}`}
                      onClick={() =>
                        update({ [opt.key]: !config[opt.key as keyof AIEngineSettings] })
                      }
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config[opt.key as keyof AIEngineSettings] ? 'left-7' : 'left-1'}`}
                      />
                    </div>
                  </label>
                ))}
              </div>

              <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-2xl">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-sm font-bold text-white">Historique gardé localement</p>
                    <p className="text-[10px] text-gray-500">
                      Nombre maximum de tours renvoyés au backend pour conserver le fil de la conversation.
                    </p>
                  </div>
                  <p className="text-lg font-black text-purple-400">{config.maxHistoryTurns}</p>
                </div>
                <input
                  type="range"
                  min={4}
                  max={20}
                  step={1}
                  title="Historique local"
                  value={config.maxHistoryTurns}
                  onChange={(e) => update({ maxHistoryTurns: Number(e.target.value) })}
                  className="w-full accent-purple-500 bg-gray-800 rounded-full h-1.5 appearance-none cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Footer Info */}
          {config.lastUpdatedBy && (
            <div className="p-4 bg-gray-900/30 rounded-xl text-center">
              <p className="text-[10px] text-gray-500">
                Configuration maintenue par{' '}
                <span className="text-gray-300 font-bold">{config.lastUpdatedBy}</span>
                {config.lastUpdatedAt
                  ? ` • ${new Date(config.lastUpdatedAt).toLocaleString()}`
                  : ''}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-4 sticky bottom-0 bg-gray-950 pb-2">
            <button
              onClick={handleReset}
              className="px-6 py-4 rounded-2xl border border-gray-800 text-gray-500 font-bold text-sm hover:bg-gray-900 hover:text-white transition-all uppercase tracking-widest"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty}
              className={`flex-1 py-4 px-8 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl ${
                dirty
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 hover:scale-[1.02]'
                  : 'bg-gray-800 text-gray-600 grayscale cursor-not-allowed opacity-50'
              }`}
            >
              {saved ? '✨ Synchronisé !' : '🚀 Déployer la Config'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
