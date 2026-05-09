import { useState, useCallback, useEffect } from 'react';
import {
  getAIEngineConfig,
  saveAIEngineConfig,
  resetAIEngineConfig,
  getModeLabelFR,
  getModeDescriptionFR,
  isAIEnabled,
  isRulesEnabled,
  type AIEngineMode,
  type AIEngineSettings,
} from '../../services/ai/AIEngineConfig';
import { 
  Bot, 
  Brain, 
  Server, 
  Sliders, 
  Zap, 
  BookOpen, 
  Cpu, 
  Code2, 
  MessageSquare, 
  ExternalLink, 
  RefreshCw, 
  ShieldAlert, 
  Wifi, 
  WifiOff,
  Save,
  RotateCcw,
  CheckCircle,
  X,
  Database,
  BarChart3,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../api/client';
import { isMasterAdminEmail } from '../../utils/roleUtils';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';

interface Props {
  user: any; // On utilise any pour plus de souplesse avec le contexte Auth
  onClose?: () => void;
  standalone?: boolean;
}

const MODES: AIEngineMode[] = [
  'RULES_ONLY',
  'HYBRID_RULES_FIRST',
  'HYBRID_AI_FIRST',
  'PRIVATE_AI_ONLY',
];

const MODE_ICONS: Record<AIEngineMode, string> = {
  RULES_ONLY: '⚙️',
  HYBRID_RULES_FIRST: '🛡️',
  HYBRID_AI_FIRST: '🧠',
  PRIVATE_AI_ONLY: '🚀',
};

const MODE_COLORS: Record<AIEngineMode, string> = {
  RULES_ONLY: 'border-blue-500/50 bg-blue-900/30 shadow-[0_0_20px_rgba(59,130,246,0.15)]',
  HYBRID_RULES_FIRST: 'border-emerald-500/50 bg-emerald-900/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  HYBRID_AI_FIRST: 'border-purple-500/50 bg-purple-900/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]',
  PRIVATE_AI_ONLY: 'border-amber-500/50 bg-amber-900/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
};

type TabId = 'engines' | 'intelligence' | 'vps' | 'settings';

export default function AIEngineAdminPanel({ user, onClose, standalone = false }: Props) {
  const isAuthorized = hasPermission(user, PERMISSIONS.CONFIGURER_MOTEUR_IA);

  const [activeTab, setActiveTab] = useState<TabId>('engines');
  const [config, setConfig] = useState<AIEngineSettings>(getAIEngineConfig());
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // VPS AI State (Copied from AdminAIConfig)
  type VpsServiceInfo = { status: 'idle' | 'checking' | 'ok' | 'error'; hint?: string; command?: string; url?: string; };
  const [vpsStatus, setVpsStatus] = useState<Record<string, VpsServiceInfo>>({
    ollama: { status: 'idle' }, webui: { status: 'idle' }, codeserver: { status: 'idle' }
  });
  const [vpsModels, setVpsModels] = useState<string[]>([]);

  const checkAllVps = useCallback(async () => {
    setVpsStatus({
      ollama: { status: 'checking' },
      webui: { status: 'checking' },
      codeserver: { status: 'checking' },
    });
    try {
      const { data } = await apiClient.get('ai/vps/status');
      setVpsStatus({
        ollama: { status: data.ollama?.status === 'ok' ? 'ok' : 'error', hint: data.ollama?.hint, command: data.ollama?.command, url: data.ollama?.url },
        webui: { status: data.webui?.status === 'ok' ? 'ok' : 'error', hint: data.webui?.hint, command: data.webui?.command, url: data.webui?.url },
        codeserver: { status: data.codeserver?.status === 'ok' ? 'ok' : 'error', hint: data.codeserver?.hint, command: data.codeserver?.command, url: data.codeserver?.url },
      });
      if (data.ollama?.models?.length > 0) setVpsModels(data.ollama.models);
    } catch {
      const errHint = '❌ Impossible de joindre le backend. Vérifiez la connexion au serveur.';
      setVpsStatus({
        ollama: { status: 'error', hint: errHint },
        webui: { status: 'error', hint: errHint },
        codeserver: { status: 'error', hint: errHint },
      });
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'vps') {
      checkAllVps();
    }
  }, [activeTab, checkAllVps]);

  if (!isAuthorized) {
    return (
      <div className={`${standalone ? '' : 'fixed inset-0 z-50'} flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4`}>
        <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-8 text-center max-w-sm shadow-[0_0_50px_rgba(239,68,68,0.1)]">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <ShieldAlert size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Accès Verrouillé</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Cette console est réservée aux administrateurs certifiés du bastion GEM.
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="w-full py-4 bg-red-600/10 text-red-400 rounded-2xl font-black uppercase tracking-widest border border-red-900/50 hover:bg-red-600/20 transition-all active:scale-95"
            >
              Quitter le Bastion
            </button>
          )}
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

  const aiActive = isAIEnabled(config);
  const rulesActive = isRulesEnabled(config);

  const TABS = [
    { id: 'engines', label: 'Moteurs', icon: Zap },
    { id: 'intelligence', label: 'Intelligence', icon: Brain },
    { id: 'vps', label: 'IA VPS', icon: Server },
    { id: 'settings', label: 'Paramètres', icon: Sliders },
  ] as const;

  const content = (
    <div className={`bg-[#020617] border border-slate-800/50 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] w-full ${standalone ? '' : 'max-w-2xl max-h-[95vh]'} overflow-hidden flex flex-col scale-in-center`}>
      {/* Header Premium */}
      <div className="relative p-8 bg-gradient-to-b from-slate-900/50 to-transparent border-b border-slate-800/40">
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600/20 rounded-2xl text-blue-400 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <Bot size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter">
                Configuration Moteur IA
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-black italic opacity-80">
                  GEM-MINT v9.0 Sovereign AI
                </p>
              </div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white transition-all border border-slate-800 active:scale-90"
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Modern Tabs Navigation */}
      <div className="flex bg-slate-900/20 border-b border-slate-800/30 px-6 gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-5 text-[10px] font-black uppercase tracking-[0.15em] transition-all relative overflow-hidden group ${
                isActive
                  ? 'text-blue-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={16} className={isActive ? 'animate-pulse' : ''} />
              <span className="hidden sm:inline">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabLine"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-[#020617] to-slate-950">
        <AnimatePresence mode="wait">
          {activeTab === 'engines' && (
            <motion.div
              key="engines"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <section className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-5 flex items-start gap-4 backdrop-blur-sm group hover:border-cyan-500/40 transition-all">
                <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400 group-hover:scale-110 transition-transform">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-400">
                    Bastion de Sécurité
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300/90 font-medium">
                    Orchestration centralisée du cerveau GEM. Les appels sont sécurisés via votre VPS privé PROQUELEC.
                  </p>
                </div>
              </section>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MODES.map((mode) => {
                  const isActive = config.mode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => update({ mode })}
                      className={`text-left p-6 rounded-3xl border-2 transition-all duration-500 relative overflow-hidden group shadow-lg ${
                        isActive
                          ? MODE_COLORS[mode] + ' ring-4 ring-blue-500/5'
                          : 'border-slate-800/60 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700/80 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-4 mb-3 relative z-10">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-3xl bg-slate-950/50 border border-white/5 transition-transform group-hover:scale-110 ${isActive ? 'shadow-[0_0_15px_rgba(255,255,255,0.1)]' : ''}`}>
                          {MODE_ICONS[mode]}
                        </div>
                        <p className={`font-black text-xs uppercase tracking-tight ${isActive ? 'text-white' : 'text-slate-400'}`}>
                          {getModeLabelFR(mode)}
                        </p>
                      </div>
                      <p className={`text-[10px] leading-relaxed relative z-10 font-bold ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                        {getModeDescriptionFR(mode)}
                      </p>
                      {isActive && (
                        <div className="absolute top-4 right-4">
                          <CheckCircle className="text-white w-5 h-5 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-2xl p-5 border transition-all duration-500 ${rulesActive ? 'bg-blue-600/10 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-slate-900/50 border-slate-800 opacity-40 grayscale'}`}>
                  <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2">Règles Métier</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${rulesActive ? 'bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-slate-600'}`}></div>
                    <p className="text-xs font-black text-white">{rulesActive ? 'OPÉRATIONNEL' : 'HORS-LIGNE'}</p>
                  </div>
                </div>
                <div className={`rounded-2xl p-5 border transition-all duration-500 ${aiActive ? 'bg-purple-600/10 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'bg-slate-900/50 border-slate-800 opacity-40 grayscale'}`}>
                  <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest mb-2">IA Privée (Ollama)</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${aiActive ? 'bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(192,132,252,0.8)]' : 'bg-slate-600'}`}></div>
                    <p className="text-xs font-black text-white">{aiActive ? 'OPÉRATIONNEL' : 'DÉSACTIVÉ'}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'intelligence' && (
            <motion.div
              key="intelligence"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    key: 'enableAutoTraining',
                    label: 'Auto-Entraînement',
                    desc: 'Apprentissage basé sur le terrain.',
                    icon: Brain,
                    color: 'from-blue-500 to-indigo-500'
                  },
                  {
                    key: 'enableResponseEnrichment',
                    label: 'Enrichissement IA',
                    desc: 'Références normatives avancées.',
                    icon: BookOpen,
                    color: 'from-emerald-500 to-teal-500'
                  },
                  {
                    key: 'enableLearningMetrics',
                    label: 'Métriques Avancées',
                    desc: 'Analytiques de progression.',
                    icon: BarChart3,
                    color: 'from-amber-500 to-orange-500'
                  },
                  {
                    key: 'enableUserFeedback',
                    label: 'Feedback Expert',
                    desc: 'Notation terrain de l\'IA.',
                    icon: MessageSquare,
                    color: 'from-purple-500 to-pink-500'
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isEnabled = config[item.key as keyof AIEngineSettings] as boolean;
                  return (
                    <label
                      key={item.key}
                      className={`flex items-start gap-4 p-5 rounded-[1.5rem] cursor-pointer transition-all duration-300 border-2 ${isEnabled ? 'bg-slate-900/80 border-blue-500/30' : 'bg-slate-900/30 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'}`}
                    >
                      <div className={`p-3 rounded-2xl bg-gradient-to-br ${isEnabled ? item.color : 'from-slate-800 to-slate-900 opacity-40'} text-white shadow-lg`}>
                        <Icon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-black text-white uppercase tracking-tight">{item.label}</p>
                          <div
                            className={`w-11 h-6 rounded-full transition-all relative ${isEnabled ? 'bg-blue-600 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-slate-800'}`}
                            onClick={(e) => {
                              e.preventDefault();
                              update({ [item.key]: !isEnabled });
                            }}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isEnabled ? 'left-6' : 'left-1'} shadow-sm`} />
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold leading-tight">{item.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="p-6 bg-gradient-to-r from-emerald-600/10 to-teal-600/5 border border-emerald-500/20 rounded-3xl flex items-center gap-5 hover:border-emerald-500/40 transition-all group">
                <div className="p-4 bg-emerald-500/20 rounded-2xl text-emerald-400 group-hover:rotate-12 transition-transform">
                  <Database size={28} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-emerald-400/60 font-black uppercase tracking-widest mb-1">Cœur de Connaissances</p>
                  <p className="text-sm text-white font-black">Bible Technique NS 01-001 & NF C18-510</p>
                </div>
                <div className="px-4 py-1.5 bg-emerald-500 text-[#020617] rounded-xl text-[10px] font-black shadow-[0_0_15px_rgba(16,185,129,0.3)]">ACTIF</div>
              </div>
            </motion.div>
          )}

          {activeTab === 'vps' && (
            <motion.div
              key="vps"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600/20 rounded-xl text-blue-400">
                      <Server size={24} />
                    </div>
                    <div>
                      <h3 className="text-md font-black text-white uppercase tracking-tight">Status IA Bastion</h3>
                      <p className="text-[10px] text-slate-500 font-bold">gem.proquelec.sn</p>
                    </div>
                  </div>
                  <button onClick={checkAllVps} className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all text-blue-400 border border-slate-700 active:rotate-180 duration-500">
                    <RefreshCw size={20} className={vpsStatus.ollama?.status === 'checking' ? 'animate-spin' : ''} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      id: 'ollama',
                      label: 'Ollama',
                      icon: Cpu,
                      port: '11434',
                      role: 'Moteur de calcul IA (LLM)',
                      docHint: 'Ollama doit être démarré sur le VPS. Sans lui, aucune réponse IA privée n\'est possible.',
                    },
                    {
                      id: 'webui',
                      label: 'Open WebUI',
                      icon: MessageSquare,
                      port: '3000',
                      role: 'Interface visuelle de gestion des modèles',
                      docHint: 'Open WebUI permet de gérer les modèles Ollama via une interface web. Non critique pour le chat GEM.',
                    },
                    {
                      id: 'codeserver',
                      label: 'Code-Server',
                      icon: Code2,
                      port: '8080',
                      role: 'Environnement de développement distant',
                      docHint: 'VS Code accessible depuis le navigateur pour éditer le code sur le VPS directement.',
                    },
                  ].map(service => {
                    const info = vpsStatus[service.id] || { status: 'idle' };
                    const isOk = info.status === 'ok';
                    const isErr = info.status === 'error';
                    const isChecking = info.status === 'checking';
                    const Icon = service.icon;
                    return (
                      <div key={service.id} className={`border rounded-2xl p-5 transition-all duration-500 ${
                        isOk ? 'bg-emerald-950/20 border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.05)]' :
                        isErr ? 'bg-rose-950/20 border-rose-500/20' :
                        'bg-slate-900/40 border-slate-800'
                      }`}>
                        {/* Header de la carte */}
                        <div className="flex items-center gap-4 mb-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                            isOk ? 'bg-emerald-600/20 text-emerald-400' :
                            isErr ? 'bg-rose-600/10 text-rose-500' :
                            'bg-slate-800 text-slate-500'
                          }`}>
                            {isChecking ? <RefreshCw size={20} className="animate-spin" /> : <Icon size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[12px] font-black text-white uppercase tracking-tight">{service.label}</p>
                              <div className={`text-[8px] font-black px-2.5 py-1 rounded-full flex-shrink-0 tracking-widest ${
                                isOk ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' :
                                isErr ? 'bg-rose-600/10 text-rose-400 border border-rose-500/30' :
                                'bg-slate-800 text-slate-500'
                              }`}>
                                {isOk ? 'OPÉRATIONNEL' : isErr ? 'HORS-LIGNE' : 'TEST...'}
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">Port {service.port} • {service.role}</p>
                          </div>
                        </div>

                        {/* Message de diagnostic */}
                        {(isErr || isOk) && (
                          <div className={`rounded-xl p-3 mt-2 text-[10px] leading-relaxed font-bold ${
                            isOk ? 'bg-emerald-950/50 text-emerald-300/80 border border-emerald-500/10' :
                            'bg-rose-950/40 text-rose-300/80 border border-rose-500/10'
                          }`}>
                            {info.hint || service.docHint}
                          </div>
                        )}

                        {/* Commande de réparation (si disponible) */}
                        {isErr && info.command && (
                          <div className="mt-2 flex items-center gap-2 bg-slate-950/80 border border-slate-700/50 rounded-xl px-3 py-2">
                            <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest flex-shrink-0">CMD ›</span>
                            <code className="text-amber-400 text-[10px] font-mono font-bold flex-1 truncate">{info.command}</code>
                          </div>
                        )}

                        {/* Hint statique si idle */}
                        {info.status === 'idle' && (
                          <p className="text-[10px] text-slate-600 mt-2 italic font-bold">{service.docHint}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {vpsModels.length > 0 && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap size={16} className="text-amber-400" />
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">Modèles Déployés</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {vpsModels.map(m => (
                      <span key={m} className="px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl text-[10px] font-mono font-bold hover:bg-blue-600/20 transition-colors cursor-default">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-6"
            >
              <div className="space-y-6">
                <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-3xl shadow-inner group">
                  <div className="flex justify-between items-end mb-5">
                    <div>
                      <p className="text-[11px] font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <CheckCircle size={14} className="text-blue-400" /> Seuil de Confiance
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">Niveau d'exigence minimal pour les réponses IA.</p>
                    </div>
                    <p className="text-2xl font-black text-blue-400 tabular-nums">{Math.round(config.confidenceThreshold * 100)}%</p>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={config.confidenceThreshold}
                    onChange={(e) => update({ confidenceThreshold: Number(e.target.value) })}
                    className="w-full accent-blue-500 bg-slate-800 rounded-full h-2 appearance-none cursor-pointer hover:accent-blue-400 transition-all"
                  />
                </div>

                <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-3xl shadow-inner group">
                  <div className="flex justify-between items-end mb-5">
                    <div>
                      <p className="text-[11px] font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Database size={14} className="text-purple-400" /> Mémoire de Session
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">Contexte historique (nombre d'échanges conservés).</p>
                    </div>
                    <p className="text-2xl font-black text-purple-400 tabular-nums">{config.maxHistoryTurns}</p>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={30}
                    step={1}
                    value={config.maxHistoryTurns}
                    onChange={(e) => update({ maxHistoryTurns: Number(e.target.value) })}
                    className="w-full accent-purple-500 bg-slate-800 rounded-full h-2 appearance-none cursor-pointer hover:accent-purple-400 transition-all"
                  />
                </div>

                <label className="flex items-center justify-between p-6 bg-slate-900/60 border border-slate-800 rounded-3xl cursor-pointer hover:border-slate-700 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl transition-all ${config.enableConversationMemory ? 'bg-purple-600/20 text-purple-400' : 'bg-slate-800 text-slate-600'}`}>
                      <RefreshCw size={20} className={config.enableConversationMemory ? 'animate-spin-slow' : ''} />
                    </div>
                    <div>
                      <p className="text-[11px] text-white font-black uppercase tracking-tight">Conservation Contexte</p>
                      <p className="text-[10px] text-slate-500 font-bold">Active la mémoire sémantique multi-tours.</p>
                    </div>
                  </div>
                  <div
                    className={`w-12 h-6 rounded-full transition-all relative ${config.enableConversationMemory ? 'bg-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-slate-800'}`}
                    onClick={() => update({ enableConversationMemory: !config.enableConversationMemory })}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.enableConversationMemory ? 'left-7' : 'left-1'} shadow-md`} />
                  </div>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Improved Footer Info Bar */}
        {config.lastUpdatedBy && (
          <div className="p-4 bg-slate-900/60 rounded-2xl text-center border border-slate-800/60 backdrop-blur-sm shadow-inner">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] flex items-center justify-center gap-2">
              Configuration sécurisée par <span className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20">{config.lastUpdatedBy}</span>
              {config.lastUpdatedAt ? ` • ${new Date(config.lastUpdatedAt).toLocaleDateString()}` : ''}
            </p>
          </div>
        )}

        {/* High-End Actions */}
        <div className={`flex gap-5 pt-4 sticky bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pb-2 ${standalone ? 'mt-6' : ''}`}>
          <button
            onClick={handleReset}
            className="px-8 py-5 rounded-2xl border-2 border-slate-800 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-600 transition-all active:scale-95 flex items-center gap-2"
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={`flex-1 py-5 px-10 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] transition-all shadow-2xl relative overflow-hidden group ${
              dirty
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-900/40 hover:scale-[1.02] active:scale-95'
                : 'bg-slate-800/50 text-slate-600 border border-slate-800/50 grayscale cursor-not-allowed'
            }`}
          >
            {dirty && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>}
            {saved ? (
              <span className="flex items-center justify-center gap-3 animate-bounce">
                <CheckCircle size={18} /> ✨ CONFIGURÉ !
              </span>
            ) : (
              <span className="flex items-center justify-center gap-3">
                <Zap size={18} className={dirty ? 'animate-pulse' : ''} /> Déployer la Config
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-10 flex flex-col items-center">
        <div className="w-full max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <Brain className="text-blue-500" />
                Console IA Souveraine
              </h1>
              <p className="text-gray-500 text-sm mt-2 font-medium">Gestion unifiée du cerveau numérique de PROQUELEC</p>
            </div>
            <div className="flex gap-2">
              <a href="/admin/diagnostic" className="p-3 bg-gray-900 border border-gray-800 rounded-2xl text-gray-400 hover:text-white transition-all">
                <RefreshCw size={20} />
              </a>
            </div>
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      {content}
    </div>
  );
}
