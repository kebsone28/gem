/**
 * 🎛️ AdminAIConfig - Page d'administration complète du système IA
 * Configuration centralisée de GEMAICore, auto-entraînement, enrichissement et IA VPS
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Settings,
  BarChart3,
  BookOpen,
  Shield,
  Zap,
  Database,
  Sliders,
  Save,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Server,
  Wifi,
  WifiOff,
  Code2,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Cpu,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getGEMAICore, type GEMAICoreConfig } from '../services/ai/GEMAICore';
import AutoTrainingPanel from '../components/ia/AITrainingStudio/AutoTrainingPanel';
import { isMasterAdminEmail } from '../utils/roleUtils';
import apiClient from '../api/client';

export default function AdminAIConfig() {
  const { user } = useAuth();
  const core = getGEMAICore();
  
  const [config, setConfig] = useState<GEMAICoreConfig>(core.getConfig());
  const [activeTab, setActiveTab] = useState<'core' | 'training' | 'metrics' | 'advanced' | 'vps'>('core');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // VPS AI State
  const [vpsStatus, setVpsStatus] = useState<Record<string, 'idle' | 'checking' | 'ok' | 'error'>>({
    ollama: 'idle', webui: 'idle', codeserver: 'idle'
  });
  const [vpsModels, setVpsModels] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const isMasterAdmin = user && (
    user.role === 'ADMIN_PROQUELEC' || 
    isMasterAdminEmail(user.email)
  );

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await core.initialize();
      setConfig(core.getConfig());
      setInitialized(true);
      setLoading(false);
    };
    initialize();
  }, []);

  const handleSaveConfig = () => {
    core.updateConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleResetConfig = () => {
    if (!confirm('Réinitialiser la configuration aux valeurs par défaut ?')) return;
    core.reset();
    setConfig(core.getConfig());
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleConfig = (key: keyof GEMAICoreConfig) => {
    setConfig((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // ✅ Test VPS via backend proxy (jamais depuis le navigateur — CORS/SSL)
  // Le backend accède à localhost:11434 directement
  const checkVpsService = useCallback(async (_service: string, _url: string) => {
    // No-op : la vérification se fait en batch via checkAllVps
  }, []);

  const checkAllVps = useCallback(async () => {
    setVpsStatus({ ollama: 'checking', webui: 'checking', codeserver: 'checking' });
    try {
      const { data } = await apiClient.get('ai/vps/status');
      setVpsStatus({
        ollama: data.ollama?.status === 'ok' ? 'ok' : 'error',
        webui: data.webui?.status === 'ok' ? 'ok' : 'error',
        codeserver: data.codeserver?.status === 'ok' ? 'ok' : 'error',
      });
      if (data.ollama?.models?.length > 0) {
        setVpsModels(data.ollama.models);
      }
    } catch {
      setVpsStatus({ ollama: 'error', webui: 'error', codeserver: 'error' });
    }
  }, []);

  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 text-center max-w-md">
          <Shield className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Accès restreint</h2>
          <p className="text-slate-400 text-sm mb-6">
            Cette page est réservée aux administrateurs système.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RotateCcw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'core', label: 'Cerveau IA', icon: Brain },
    { id: 'training', label: 'Auto-Entraînement', icon: BookOpen },
    { id: 'metrics', label: 'Métriques', icon: BarChart3 },
    { id: 'advanced', label: 'Avancé', icon: Sliders },
    { id: 'vps', label: 'IA VPS', icon: Server },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                <Settings className="text-blue-400" />
                Administration Système IA
              </h1>
              <p className="text-slate-400 text-sm mt-2">
                Configuration centralisée de GEMAICore et auto-entraînement
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResetConfig}
                className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Reset
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors flex items-center gap-2"
              >
                {saved ? <CheckCircle size={16} /> : <Save size={16} />}
                {saved ? 'Sauvegardé' : 'Sauvegarder'}
              </button>
            </div>
          </div>

          {/* Onglets de navigation */}
          <div className="flex gap-2 border-b border-slate-800">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'text-blue-400 border-blue-400'
                      : 'text-slate-500 border-transparent hover:text-slate-400'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu des onglets */}
        <AnimatePresence mode="wait">
          {activeTab === 'core' && (
            <motion.div
              key="core"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Configuration GEMAICore */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Zap className="text-blue-400" />
                  Configuration du Cerveau IA
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      key: 'enableAutoTraining',
                      label: 'Auto-Entraînement',
                      description: 'Active l\'apprentissage automatique basé sur les interactions utilisateur',
                      icon: Brain,
                    },
                    {
                      key: 'enableResponseEnrichment',
                      label: 'Enrichissement des Réponses',
                      description: 'Ajoute automatiquement des métadonnées (références, risques, étapes)',
                      icon: BookOpen,
                    },
                    {
                      key: 'enableLearningMetrics',
                      label: 'Métriques d\'Apprentissage',
                      description: 'Collecte et affiche les métriques d\'apprentissage en temps réel',
                      icon: BarChart3,
                    },
                    {
                      key: 'enableUserFeedback',
                      label: 'Feedback Utilisateur',
                      description: 'Permet aux utilisateurs de noter les réponses IA',
                      icon: Shield,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isEnabled = config[item.key as keyof GEMAICoreConfig] as boolean;
                    return (
                      <label
                        key={item.key}
                        className="flex items-start gap-4 p-4 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-all"
                      >
                        <div
                          className={`p-2 rounded-lg ${isEnabled ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}
                        >
                          <Icon size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-bold text-white">{item.label}</p>
                            <div
                              className={`w-10 h-6 rounded-full transition-all relative ${isEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleConfig(item.key as keyof GEMAICoreConfig);
                              }}
                            >
                              <div
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isEnabled ? 'left-5' : 'left-1'}`}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-slate-500">{item.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Configuration avancée */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Sliders className="text-purple-400" />
                  Paramètres Avancés
                </h2>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <p className="text-sm font-bold text-white">Suggestions d'Entraînement Max</p>
                        <p className="text-xs text-slate-500">
                          Nombre maximum de suggestions d'entraînement à générer
                        </p>
                      </div>
                      <p className="text-lg font-black text-purple-400">{config.maxTrainingSuggestions}</p>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={10}
                      value={config.maxTrainingSuggestions}
                      onChange={(e) => setConfig((prev) => ({ ...prev, maxTrainingSuggestions: Number(e.target.value) }))}
                      className="w-full accent-purple-500 bg-slate-800 rounded-full h-2 appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <p className="text-sm font-bold text-white">Seuil de Confiance</p>
                        <p className="text-xs text-slate-500">
                          Seuil minimum de confiance pour accepter une réponse IA
                        </p>
                      </div>
                      <p className="text-lg font-black text-purple-400">{Math.round(config.confidenceThreshold * 100)}%</p>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.1}
                      value={config.confidenceThreshold}
                      onChange={(e) => setConfig((prev) => ({ ...prev, confidenceThreshold: Number(e.target.value) }))}
                      className="w-full accent-purple-500 bg-slate-800 rounded-full h-2 appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'training' && (
            <motion.div
              key="training"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AutoTrainingPanel canManageAI={true} />
            </motion.div>
          )}

          {activeTab === 'metrics' && (
            <motion.div
              key="metrics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <BarChart3 className="text-emerald-400" />
                  Métriques d'Apprentissage
                </h2>
                
                <div className="text-center py-12 text-slate-400">
                  <Database className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">Métriques détaillées à venir</p>
                  <p className="text-xs mt-2">Les métriques d'apprentissage seront affichées ici</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== ONGLET IA VPS ===== */}
          {activeTab === 'vps' && (
            <motion.div
              key="vps"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Header VPS */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 border border-indigo-500/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                      <Server className="text-indigo-400" size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white">IA Locale — VPS Proquelec</h2>
                      <p className="text-xs text-slate-400 font-mono">gem.proquelec.sn</p>
                    </div>
                  </div>
                  <button
                    onClick={checkAllVps}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    <RefreshCw size={14} /> Tester la connexion
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Votre fournisseur a installé une IA locale (Ollama) sur ce serveur. Cette page vous permet de vérifier son état
                  et de configurer votre projet pour l'utiliser comme source IA principale.
                </p>

                {/* Note sur le protocole */}
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                  <ShieldAlert className="text-amber-500 mt-0.5" size={16} />
                  <div className="text-[10px] text-amber-200/70 leading-relaxed">
                    <span className="font-bold text-amber-500">Note de sécurité :</span> Ces services utilisent le protocole <span className="text-white underline">HTTP</span>. 
                    Si vous rencontrez une erreur <span className="font-mono text-white">ERR_SSL_PROTOCOL_ERROR</span>, assurez-vous que l'URL dans votre barre d'adresse commence bien par <span className="font-bold text-white">http://</span> (sans le "s") ou utilisez le bouton "Ouvrir" ci-dessous.
                  </div>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    id: 'ollama',
                    label: 'Ollama (LLM Engine)',
                    url: 'gem.proquelec.sn:11434',
                    icon: Cpu,
                    description: 'Moteur IA local — génère les réponses',
                    color: 'emerald',
                    link: null
                  },
                  {
                    id: 'codeserver',
                    label: 'code-server (VS Code Web)',
                    url: 'gem.proquelec.sn:8080',
                    icon: Code2,
                    description: 'VS Code dans le navigateur — éditer le code serveur',
                    color: 'blue',
                    link: 'http://gem.proquelec.sn:8080'
                  },
                  {
                    id: 'webui',
                    label: 'Open WebUI (Chat IA)',
                    url: 'gem.proquelec.sn:3000',
                    icon: MessageSquare,
                    description: 'Interface ChatGPT-like avec vos modèles locaux',
                    color: 'purple',
                    link: 'http://gem.proquelec.sn:3000'
                  }
                ].map(service => {
                  const Icon = service.icon;
                  const status = vpsStatus[service.id];
                  const isOk = status === 'ok';
                  const isErr = status === 'error';
                  const isChecking = status === 'checking';
                  return (
                    <div key={service.id} className={`bg-slate-900 border rounded-2xl p-5 transition-all ${
                      isOk ? 'border-emerald-500/30' : isErr ? 'border-rose-500/30' : 'border-slate-800'
                    }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isOk ? 'bg-emerald-500/20 text-emerald-400' : isErr ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <Icon size={20} />
                        </div>
                        <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full ${
                          isOk ? 'bg-emerald-500/10 text-emerald-400' :
                          isErr ? 'bg-rose-500/10 text-rose-400' :
                          isChecking ? 'bg-amber-500/10 text-amber-400' :
                          'bg-slate-800 text-slate-500'
                        }`}>
                          {isOk ? <><Wifi size={10} /> ACTIF</> :
                           isErr ? <><WifiOff size={10} /> INACTIF</> :
                           isChecking ? <><RefreshCw size={10} className="animate-spin" /> TEST...</> :
                           '— EN ATTENTE'}
                        </div>
                      </div>
                      <p className="text-sm font-bold text-white mb-1">{service.label}</p>
                      <p className="text-xs text-slate-500 font-mono mb-2">{service.url}</p>
                      <p className="text-xs text-slate-600">{service.description}</p>
                      {service.link && (
                        <a
                          href={service.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink size={10} /> Ouvrir dans le navigateur
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Modèles Ollama détectés */}
              {vpsModels.length > 0 && (
                <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Brain className="text-emerald-400" size={16} />
                    Modèles IA détectés sur le VPS
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {vpsModels.map(model => (
                      <div key={model} className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0" />
                        <span className="text-xs font-mono text-emerald-300 truncate">{model}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Config Continue (VS Code) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Code2 className="text-blue-400" size={16} />
                  Intégration VS Code — Extension "Continue"
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Le fichier <span className="font-mono text-blue-300">.continue/config.json</span> a été généré dans votre projet.
                  Il configure l'extension Continue pour utiliser Ollama sur votre VPS directement depuis VS Code.
                </p>
                <div className="space-y-3">
                  {[
                    { step: '1', label: 'Installer l\'extension Continue dans VS Code', detail: 'Cherchez "Continue" dans les extensions VS Code (ID: Continue.continue)' },
                    { step: '2', label: 'Le fichier config est déjà prêt', detail: '.continue/config.json pointe vers Ollama sur gem.proquelec.sn' },
                    { step: '3', label: 'Ouvrir le projet dans code-server sur le VPS', detail: 'http://gem.proquelec.sn:8080/?folder=/var/www/proquelec/gem-saas' },
                    { step: '4', label: 'L\'IA est disponible dans l\'éditeur', detail: 'Utilisez ⌘+L (ou Ctrl+L) pour ouvrir le chat IA' },
                  ].map(item => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">{item.step}</div>
                      <div>
                        <p className="text-xs font-bold text-slate-300">{item.label}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <a
                  href="http://gem.proquelec.sn:8080/?folder=/var/www/proquelec/gem-saas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex items-center justify-center gap-2 w-full py-3 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                >
                  <ExternalLink size={14} /> Ouvrir code-server sur le VPS
                </a>
              </div>
            </motion.div>
          )}

          {activeTab === 'advanced' && (
            <motion.div
              key="advanced"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <AlertTriangle className="text-amber-400" />
                  Configuration Avancée
                </h2>
                
                <div className="space-y-4">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <p className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Zone de danger
                    </p>
                    <p className="text-xs text-amber-200/70 mt-2">
                      Ces paramètres affectent le comportement global du système IA. Modifiez-les avec précaution.
                    </p>
                  </div>

                  <div className="text-center py-8 text-slate-400">
                    <p className="text-sm font-medium">Paramètres avancés à venir</p>
                    <p className="text-xs mt-2">Configuration du backend, gestion des secrets, etc.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
