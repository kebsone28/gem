import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { modulesManagementService, AVAILABLE_MODULES } from '../services/modulesManagementService';
// auditService utilisé en interne par modulesManagementService — pas besoin ici
import logger from '../utils/logger';
import toast from 'react-hot-toast';
import * as LucideIcons from 'lucide-react';
import {
  HelpCircle,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Settings,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../components';

interface ModuleStats {
  moduleId: string;
  name: string;
  globalEnabled: boolean;
  userCount: number;
  category: string;
  globalToggleable: boolean;
}

export default function AdminModules() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [modules, setModules] = useState(AVAILABLE_MODULES);
  const [loading, setLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    moduleId: string;
    moduleName: string;
    enabled: boolean;
  } | null>(null);

  const [stats, setStats] = useState<Record<string, ModuleStats>>({});
  const [showDisabled, setShowDisabled] = useState(false);

  // Charger la configuration actuelle des modules
  const loadModules = async () => {
    setLoading(true);
    try {
      const globalConfig = await modulesManagementService.getGlobalModulesConfig();
      const modulesStats = await modulesManagementService.getModulesUsageStats();

      setModules(Object.entries(globalConfig).map(([id, config]) => config));
      setStats(modulesStats);
    } catch (error) {
      logger.error('[AdminModules] Error loading modules:', error);
      toast.error('Erreur lors du chargement des modules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, []);

  // Basculer un module globalement
  const toggleModule = async (moduleId: string, enabled: boolean) => {
    if (!user) return;

    try {
      await modulesManagementService.toggleGlobalModule(moduleId, enabled, user.id);

      // Mettre à jour l'état local
      setModules((prev) =>
        prev.map((module) => (module.id === moduleId ? { ...module, enabled } : module))
      );

      // Mettre à jour les stats
      setStats((prev) => ({
        ...prev,
        [moduleId]: {
          ...prev[moduleId],
          globalEnabled: enabled,
        },
      }));

      toast.success(
        `Module ${modules.find((m) => m.id === moduleId)?.name} ${enabled ? 'activé' : 'désactivé'} globalement`
      );
    } catch (error: any) {
      logger.error('[AdminModules] Error toggling module:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  };

  // Ouvrir la confirmation
  const openConfirmModal = (moduleId: string, enabled: boolean) => {
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;

    setConfirmModal({
      moduleId,
      moduleName: module.name,
      enabled,
    });
  };

  // Confirmer l'action
  const confirmToggle = async () => {
    if (!confirmModal) return;

    await toggleModule(confirmModal.moduleId, confirmModal.enabled);
    setConfirmModal(null);
  };

  // Obtenir l'icône du module
  const getModuleIcon = (iconName?: string) => {
    return (LucideIcons as any)[iconName || 'Settings'] || HelpCircle;
  };

  // Obtenir la couleur de la catégorie
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      core: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
      advanced: 'bg-purple-500/10 border-purple-500/50 text-purple-400',
      experimental: 'bg-orange-500/10 border-orange-500/50 text-orange-400',
      admin: 'bg-red-500/10 border-red-500/50 text-red-400',
    };
    return colors[category] || colors.core;
  };

  // Grouper les modules par catégorie
  const modulesByCategory = modules.reduce(
    (acc, module) => {
      if (!acc[module.category]) {
        acc[module.category] = [];
      }
      acc[module.category].push(module);
      return acc;
    },
    {} as Record<string, typeof modules>
  );

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      {/* Modal de confirmation */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-500">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-purple-100 border border-blue-200 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                  <Settings className="text-blue-600" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-black text-xl leading-snug">
                    {confirmModal.enabled ? 'Activation' : 'Désactivation'} Globale
                  </h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">
                    Module: {confirmModal.moduleName}
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-[2rem] bg-slate-800/50 border border-slate-700 mb-8">
                <p className="text-slate-300 text-sm font-medium mb-3">
                  Vous êtes sur le point de {confirmModal.enabled ? 'activer' : 'désactiver'} le
                  module <strong>{confirmModal.moduleName}</strong> pour tous les utilisateurs.
                </p>
                <div className="space-y-2 text-sm text-slate-400">
                  {confirmModal.enabled ? (
                    <>
                      <p>• Tous les utilisateurs auront accès à ce module</p>
                      <p>• Les fonctionnalités seront activées globalement</p>
                      <p>• Cette action peut être inversée à tout moment</p>
                    </>
                  ) : (
                    <>
                      <p>• Tous les utilisateurs perdront l'accès à ce module</p>
                      <p>• Les fonctionnalités seront désactivées globalement</p>
                      <p>• Les données existantes seront conservées</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-4 bg-slate-800/50 text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-800 hover:text-white transition-all"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmToggle}
                  className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all shadow-xl active:scale-95 ${
                    confirmModal.enabled
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
                      : 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white'
                  }`}
                >
                  {confirmModal.enabled ? 'Activer' : 'Désactiver'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader backLink={{ to: '/admin/hub', label: 'Retour au Centre de Contrôle' }}
        title="Gestion des Modules"
        subtitle="Configuration globale des fonctionnalités du système"
        icon={<Settings size={24} />}
      />

      <ContentArea className="space-y-8 p-8 bg-slate-950 border-slate-800">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* ── Définition de la page ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6 flex flex-col sm:flex-row gap-6">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Settings size={22} className="text-blue-400" />
            </div>
            <div className="space-y-3 flex-1">
              <p className="text-slate-200 text-sm font-medium leading-relaxed">
                Cette page vous permet de contrôler les <span className="text-white font-bold">fonctionnalités actives</span> sur toute la plateforme.
                Chaque module correspond à un ensemble de pages, d'API et de permissions.
                Désactiver un module le rend <span className="text-rose-400 font-bold">inaccessible pour tous les utilisateurs</span>, quel que soit leur rôle — y compris au niveau API.
              </p>
              <div className="flex flex-wrap gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <CheckCircle2 size={12} /> Core — Toujours actif, non modifiable
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Eye size={12} /> Avancé — Activable / Désactivable globalement
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <AlertTriangle size={12} /> Admin — Outils système réservés aux administrateurs
                </span>
              </div>
            </div>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <BarChart3 className="text-blue-400" size={20} />
                </div>
                <span className="text-blue-400 text-sm font-medium">Modules Core</span>
              </div>
              <p className="text-2xl font-black text-white">
                {Object.values(modulesByCategory).filter((m) => m[0]?.category === 'core').length}
              </p>
              <p className="text-xs text-blue-400">Toujours actifs</p>
            </div>

            <div className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Zap className="text-purple-400" size={20} />
                </div>
                <span className="text-purple-400 text-sm font-medium">Modules Avancés</span>
              </div>
              <p className="text-2xl font-black text-white">
                {modules.filter((m) => m.category === 'advanced' && m.enabled).length}/
                {modules.filter((m) => m.category === 'advanced').length}
              </p>
              <p className="text-xs text-purple-400">Activables globalement</p>
            </div>

            <div className="p-6 bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="text-orange-400" size={20} />
                </div>
                <span className="text-orange-400 text-sm font-medium">Modules Expérimentaux</span>
              </div>
              <p className="text-2xl font-black text-white">
                {modules.filter((m) => m.category === 'experimental' && m.enabled).length}/
                {modules.filter((m) => m.category === 'experimental').length}
              </p>
              <p className="text-xs text-orange-400">Usage contrôlé</p>
            </div>

            <div className="p-6 bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="text-red-400" size={20} />
                </div>
                <span className="text-red-400 text-sm font-medium">Modules Admin</span>
              </div>
              <p className="text-2xl font-black text-white">
                {modules.filter((m) => m.category === 'admin' && m.enabled).length}/
                {modules.filter((m) => m.category === 'admin').length}
              </p>
              <p className="text-xs text-red-400">Accès restreint</p>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">Configuration des Modules</h2>
            <button
              onClick={() => setShowDisabled(!showDisabled)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl text-slate-400 hover:text-white transition-all"
            >
              {showDisabled ? <EyeOff size={16} /> : <Eye size={16} />}
              {showDisabled ? 'Cacher' : 'Afficher'} les désactivés
            </button>
          </div>

          {/* Modules par catégorie */}
          {Object.entries(modulesByCategory).map(([category, categoryModules]) => {
            const CategoryIcon = getModuleIcon(categoryModules[0]?.icon);
            return (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${getCategoryColor(category)}`}
                  >
                    <CategoryIcon size={20} />
                  </div>
                  <h3 className="text-lg font-black text-white capitalize">
                    {category === 'core'
                      ? 'Modules Core'
                      : category === 'advanced'
                        ? 'Modules Avancés'
                        : category === 'experimental'
                          ? 'Modules Expérimentaux'
                          : 'Modules Admin'}
                  </h3>
                  <span className="text-xs text-slate-500 uppercase tracking-widest">
                    {categoryModules.filter((m) => m.enabled).length}/{categoryModules.length}{' '}
                    activés
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryModules
                    .filter((module) => showDisabled || module.enabled)
                    .map((module) => {
                      const ModuleIcon = getModuleIcon(module.icon);
                      const moduleStats = stats[module.id];
                      const isGloballyEnabled = module.enabled;
                      const canToggleGlobally = module.global;

                      return (
                        <motion.div
                          key={module.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-6 rounded-2xl border transition-all cursor-pointer hover:shadow-xl ${
                            isGloballyEnabled
                              ? 'bg-gradient-to-br from-slate-800/50 to-slate-700/50 border-slate-600/50'
                              : 'bg-slate-900/50 border-slate-800/50 opacity-60'
                          }`}
                          onClick={() =>
                            canToggleGlobally && openConfirmModal(module.id, !isGloballyEnabled)
                          }
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center ${getCategoryColor(category)}`}
                              >
                                <ModuleIcon size={24} />
                              </div>
                              <div>
                                <h4 className="text-white font-black text-base mb-1">
                                  {module.name}
                                </h4>
                                <p className="text-slate-400 text-xs">{module.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {canToggleGlobally ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openConfirmModal(module.id, !isGloballyEnabled);
                                  }}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                    isGloballyEnabled ? 'bg-blue-600' : 'bg-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      isGloballyEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              ) : (
                                <div className="px-3 py-1 bg-slate-700 rounded-lg">
                                  <span className="text-xs text-slate-400">Non désactivable</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Statistiques d'utilisation */}
                          {moduleStats && (
                            <div className="mt-4 pt-4 border-t border-slate-700/50">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">
                                  {moduleStats.userCount} utilisateur
                                  {moduleStats.userCount > 1 ? 's' : ''}
                                </span>
                                <div className="flex items-center gap-2">
                                  {isGloballyEnabled ? (
                                    <>
                                      <CheckCircle2 className="text-emerald-400" size={14} />
                                      <span className="text-emerald-400">Actif</span>
                                    </>
                                  ) : (
                                    <>
                                      <X className="text-slate-500" size={14} />
                                      <span className="text-slate-500">Inactif</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Permissions requises */}
                          <div className="mt-3">
                            <p className="text-xs text-slate-500 mb-2">Permissions requises:</p>
                            <div className="flex flex-wrap gap-1">
                              {(module.permissions || []).map((perm) => (
                                <span
                                  key={perm}
                                  className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300"
                                >
                                  {perm}
                                </span>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              </div>
            );
          })}

          {/* Actions globales */}
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={() => navigate('/admin/users')}
              className="px-6 py-3 bg-slate-800/50 text-slate-400 rounded-xl hover:text-white transition-all"
            >
              Gestion des utilisateurs
            </button>
            <button
              onClick={loadModules}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Chargement...' : 'Actualiser'}
            </button>
          </div>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
