/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Loader2, CheckCircle2, Trash2,
  LayoutDashboard, MapPin, ClipboardList, Calculator,
  Calendar, MessageSquare, Truck, BarChart3, FileText,
  BookOpen, Users, Shield, Zap, GraduationCap,
  AlertTriangle, Settings, ClipboardCheck, Activity,
  LayoutGrid, Folder, ShieldCheck, Terminal, RefreshCw
} from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { normalizeRole, ROLES } from '@core/security/permissions';
import { MODULE_REGISTRY } from '@core/kernel/registry';
import projectService from '@services/projectService';
import toast from 'react-hot-toast';
import { extractApiError } from '@utils/format';
import { PageContainer, PageHeader, ContentArea } from '@components';

// ─── Module definition ──────────────────────────────────
interface ProjectModule {
  key: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  enabled: boolean;
  required?: boolean;
}

// Icon lookup map (module key → Lucide component)
const MODULE_ICONS: Record<string, any> = {
  dashboard: LayoutDashboard, terrain: MapPin, mission: ClipboardList,
  simulation: Calculator, charges: BarChart3, planning: Calendar,
  communication: MessageSquare, logistique: Truck, atelier: LayoutGrid,
  sharedoc: Folder, cahier: FileText, bordereau: BookOpen,
  pv_automation: ShieldCheck, mes: Zap, kobo_mapping: RefreshCw,
  kobo_terminal: Terminal, users: Users, approval: Shield,
  formation: GraduationCap, diagnostic: Activity,
  ged_os_toolbox: ClipboardCheck, ged_os_collect: Activity,
};

// Color map (module key → Tailwind text color)
const MODULE_COLORS: Record<string, string> = {
  dashboard: 'text-blue-400', terrain: 'text-emerald-400', mission: 'text-indigo-400',
  simulation: 'text-violet-400', charges: 'text-green-400', planning: 'text-sky-400',
  communication: 'text-pink-400', logistique: 'text-orange-400', atelier: 'text-cyan-400',
  sharedoc: 'text-slate-400', cahier: 'text-amber-400', bordereau: 'text-lime-400',
  pv_automation: 'text-purple-400', mes: 'text-yellow-400', kobo_mapping: 'text-blue-400',
  kobo_terminal: 'text-emerald-400', users: 'text-teal-400', approval: 'text-purple-400',
  formation: 'text-green-400', diagnostic: 'text-rose-400',
  ged_os_toolbox: 'text-yellow-400', ged_os_collect: 'text-cyan-400',
};

// Build ALL_MODULES dynamically from MODULE_REGISTRY
const PROJECT_MODULE_KEYS = [
  'dashboard', 'terrain', 'mission', 'simulation', 'charges', 'planning',
  'communication', 'logistique', 'atelier', 'sharedoc', 'cahier', 'bordereau',
  'pv_automation', 'mes', 'kobo_mapping', 'kobo_terminal', 'users', 'approval',
  'formation', 'diagnostic', 'ged_os_toolbox', 'ged_os_collect',
];

const ALL_MODULES: Omit<ProjectModule, 'enabled'>[] = PROJECT_MODULE_KEYS
  .map((key) => {
    const manifest = MODULE_REGISTRY[key];
    if (!manifest) return null;
    return {
      key: manifest.key,
      label: manifest.name,
      description: manifest.description,
      icon: MODULE_ICONS[key] || Activity,
      color: MODULE_COLORS[key] || 'text-slate-400',
      required: key === 'dashboard',
    };
  })
  .filter(Boolean) as Omit<ProjectModule, 'enabled'>[];

export default function AdminProjectEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'planning' | 'completed' | 'paused'>('active');
  const [modules, setModules] = useState<ProjectModule[]>([]);

  // ── Guard ──────────────────────────────────────────────────────────────────
  const nRole = normalizeRole(user?.role || '');
  const canEdit = nRole === ROLES.ADMIN || nRole === ROLES.DIRECTEUR;

  useEffect(() => {
    if (!canEdit) {
      toast.error('Accès refusé');
      navigate('/projects');
      return;
    }
    if (!id) return;

    (async () => {
      setLoading(true);
      try {
        const project = await projectService.getProject(id);
        setName(project.name || '');
        setDescription((project as any).description || '');
        setStatus((project.status as any) || 'active');

        // Build enabled modules from project.config.enabledModules
        const enabledKeys: string[] = (project as any).config?.enabledModules || [];
        setModules(
          ALL_MODULES.map((m) => ({
            ...m,
            enabled: m.required || enabledKeys.includes(m.key),
          }))
        );
      } catch {
        toast.error('Impossible de charger le projet');
        navigate('/projects');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleModule = (key: string) => {
    setModules((prev) =>
      prev.map((m) => (m.key === key && !m.required ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Le nom du projet est obligatoire');
      return;
    }
    setSaving(true);
    try {
      const enabledModules = modules.filter((m) => m.enabled).map((m) => m.key);
      await projectService.updateProject(id!, {
        name: name.trim(),
        status,
        config: {
          enabledModules,
          description: description.trim(),
        },
      } as any);
      toast.success(`✅ Projet "${name.trim()}" mis à jour`);
      navigate('/projects');
    } catch (err: any) {
      toast.error(extractApiError(err, 'Erreur lors de la sauvegarde'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le projet "${name}" ? Cette action est irréversible.`)) {
      return;
    }
    
    // Double confirmation de sécurité
    const confirmName = window.prompt(`Pour confirmer, veuillez taper le nom du projet : "${name}"`);
    if (confirmName !== name) {
      toast.error('Le nom saisi ne correspond pas. Suppression annulée.');
      return;
    }

    // Demande du mot de passe (requis par le backend)
    const password = window.prompt(`Par mesure de sécurité, veuillez entrer votre mot de passe pour supprimer ce projet :`);
    if (!password) {
      toast.error('Le mot de passe est requis. Suppression annulée.');
      return;
    }

    setDeleting(true);
    try {
      await projectService.deleteProject(id!, password);
      toast.success(`✅ Projet supprimé avec succès`);
      navigate('/projects');
    } catch (err: any) {
      toast.error(extractApiError(err, 'Erreur lors de la suppression'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-400" size={40} />
      </div>
    );
  }

  const enabledCount = modules.filter((m) => m.enabled).length;

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      <PageHeader
        backLink={{ to: '/projects', label: 'Retour aux Projets' }}
        title="Modifier le Projet"
        subtitle="Paramètres et modules actifs"
        icon={<Settings size={28} className="text-white" />}
      />

      <ContentArea className="max-w-4xl mx-auto space-y-8 mt-8">
        {/* Main form */}
          {/* ── Infos générales ───────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 space-y-6"
          >
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Informations générales</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                  Nom du Projet *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Projet Kobo Global"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500/50 outline-none font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                  Statut
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                >
                  <option value="active">Actif</option>
                  <option value="planning">En planification</option>
                  <option value="paused">En pause</option>
                  <option value="completed">Terminé</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                Description (optionnel)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Décrivez l'objectif de ce projet..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none"
              />
            </div>
          </motion.section>

          {/* ── Modules activables ─────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">Modules du Projet</h2>
                <p className="text-slate-500 text-sm mt-1">
                  {enabledCount} / {modules.length} modules activés
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModules((prev) => prev.map((m) => ({ ...m, enabled: true })))}
                  className="text-xs font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                >
                  Tout activer
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setModules((prev) => prev.map((m) => ({ ...m, enabled: !!m.required })))
                  }
                  className="text-xs font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700 transition-all"
                >
                  Réinitialiser
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.key}
                    type="button"
                    onClick={() => toggleModule(mod.key)}
                    disabled={mod.required}
                    className={`relative flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-200 group ${
                      mod.enabled
                        ? 'bg-indigo-500/10 border-indigo-500/30 shadow-lg shadow-indigo-950/50'
                        : 'bg-slate-950/60 border-slate-800/50 hover:border-slate-700 opacity-60'
                    } ${mod.required ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-[1.01]'}`}
                  >
                    <div
                      className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        mod.enabled ? 'bg-indigo-500/20' : 'bg-slate-800'
                      }`}
                    >
                      <Icon size={20} className={mod.enabled ? mod.color : 'text-slate-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-black truncate ${mod.enabled ? 'text-white' : 'text-slate-500'}`}>
                        {mod.label}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">
                        {mod.description}
                      </p>
                    </div>
                    {/* State indicator */}
                    <div className="absolute top-3 right-3">
                      {mod.required ? (
                        <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400/60">
                          Requis
                        </span>
                      ) : mod.enabled ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-700" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-[10px] text-slate-600 flex items-center gap-2 italic">
              <AlertTriangle size={10} className="text-amber-500/60" />
              Le Tableau de Bord est toujours actif et ne peut pas être désactivé.
            </p>
          </motion.section>

          {/* ── Action bar ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pb-8">
            <button
              onClick={() => navigate('/projects')}
              className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 font-bold transition-all"
            >
              Annuler
            </button>
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDelete}
                disabled={saving || deleting}
                className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-bold transition-all shadow-xl shadow-red-500/10 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                Supprimer
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving || deleting}
                className="flex items-center gap-3 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {saving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
              </motion.button>
            </div>
          </div>
      </ContentArea>
    </PageContainer>
  );
}
