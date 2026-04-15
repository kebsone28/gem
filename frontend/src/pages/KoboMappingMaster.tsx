import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Link2,
  Search,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  ArrowRight,
  Settings2,
  Info,
  Lock,
  Unlock,
  Hash,
  User,
  Phone,
  MapPin,
  Home,
  Package,
  PenTool,
  Navigation,
  ShieldCheck,
  Zap,
  Briefcase,
  ChevronDown,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '@components';
import { useAuth } from '@contexts/AuthContext';
import { organizationService } from '@services/organizationService';
import projectService from '@services/projectService';
import { auditService } from '@services/auditService';

/**
 * 🎯 KOBO MASTER ENGINE v2.0 (Multi-Project & Dynamic Field Mapping)
 * Allows administrators to map Kobo fields to GEM fields independently for each project.
 */
export default function KoboMappingMaster() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ORG_GLOBAL');
  const [config, setConfig] = useState<any>({ kobo_field_mapping: {} });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [searchField, setSearchField] = useState('');
  const [isLocked, setIsLocked] = useState(true);

  // Predefined Database Fields (GEM Targets)
  const TARGET_FIELDS = [
    {
      section: 'Identité',
      fields: [
        { id: 'numeroordre', label: "N° d'Ordre (Clé Unique)", required: true, icon: Hash },
        { id: 'name', label: 'Nom du Chef de Ménage', required: true, icon: User },
        { id: 'phone', label: 'Téléphone Mobile', required: false, icon: Phone },
      ],
    },
    {
      section: 'Géographie',
      fields: [
        { id: 'region', label: 'Région / Gouvernorat', required: true, icon: MapPin },
        { id: 'departement', label: 'Département', required: false, icon: MapPin },
        { id: 'village', label: 'Village / Quartier', required: false, icon: Home },
        {
          id: 'gps_geopoint',
          label: 'Point GPS (Geopoint complet)',
          required: false,
          icon: Navigation,
        },
        {
          id: 'gps_latitude',
          label: 'GPS: Latitude (si séparé)',
          required: false,
          icon: Navigation,
        },
        {
          id: 'gps_longitude',
          label: 'GPS: Longitude (si séparé)',
          required: false,
          icon: Navigation,
        },
      ],
    },
    {
      section: 'Progression Technique',
      fields: [
        { id: 'status_macon_ok', label: 'Validation Maçonnerie', required: false, icon: Zap },
        { id: 'status_reseau_ok', label: 'Validation Réseau', required: false, icon: Zap },
        {
          id: 'status_interieur_ok',
          label: 'Validation Installation Int.',
          required: false,
          icon: Zap,
        },
        {
          id: 'status_control_ok',
          label: 'Validation Contrôle Final',
          required: false,
          icon: ShieldCheck,
        },
        { id: 'status_livraison_ok', label: 'Preuve de Livraison', required: false, icon: Package },
        {
          id: 'client_signature',
          label: 'Signature Client (Data)',
          required: false,
          icon: PenTool,
        },
      ],
    },
    {
      section: 'Statut & Éligibilité',
      fields: [
        {
          id: 'situation_menage',
          label: 'Éligibilité (Situation)',
          required: false,
          icon: AlertCircle,
        },
        { id: 'justificatif', label: 'Justificatif (Désistement)', required: false, icon: Info },
      ],
    },
  ];

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadMappingConfig();
  }, [selectedProjectId]);

  const loadProjects = async () => {
    try {
      const data = await projectService.getProjects();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to load projects');
    }
  };

  const loadMappingConfig = async () => {
    try {
      let data;
      if (selectedProjectId === 'ORG_GLOBAL') {
        data = await organizationService.getConfig();
      } else {
        data = await projectService.getProject(selectedProjectId);
      }

      const mapping = data.config?.kobo_field_mapping || {};
      setConfig({ ...data.config, kobo_field_mapping: mapping });
      setLastSync(new Date().toLocaleString());
    } catch (err) {
      console.error('Failed to load mapping config');
    }
  };

  const handleMapChange = (targetId: string, koboField: string) => {
    const nextMapping = { ...config.kobo_field_mapping, [targetId]: koboField };
    setConfig({ ...config, kobo_field_mapping: nextMapping });
  };

  const saveMapping = async () => {
    setIsSaving(true);
    try {
      if (selectedProjectId === 'ORG_GLOBAL') {
        await organizationService.updateConfig(config);
      } else {
        await projectService.updateProject(selectedProjectId, { config });
      }

      if (user) {
        auditService.logAction(
          user,
          `Mise à jour Mapping [${selectedProjectId}]`,
          'KOBO_ENGINE',
          `Configuration du traducteur Kobo mise à jour.`,
          'warning'
        );
      }

      await new Promise((r) => setTimeout(r, 800));
      setIsLocked(true);
      setLastSync(new Date().toLocaleString());
    } catch (err) {
      console.error('Failed to save mapping');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-12">
      <PageHeader
        title="Kobo Engine Master v2.0"
        subtitle="Moteur de mapping dynamique pour l'ingestion multi-projets."
        icon={<Settings2 size={24} className="text-blue-400" />}
      />

      <ContentArea className="max-w-6xl mx-auto space-y-10 p-8">
        {/* 🏢 PROJECT SELECTOR (THE ISOLATION BAR) */}
        <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
              <Briefcase size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-1">
                Contexte de Mapping Actuel
              </p>
              <div className="relative group">
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  title="Sélectionner le projet pour le mapping"
                  aria-label="Sélectionner le projet pour le mapping"
                  className="bg-transparent text-xl font-black text-white italic outline-none cursor-pointer appearance-none pr-8 hover:text-blue-400 transition-colors"
                >
                  <option value="ORG_GLOBAL">🌏 TEMPLATE GLOBAL (ORGANISATION)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-sm">
                      📁 {p.name.toUpperCase()}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsLocked(!isLocked)}
              className={`h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 italic ${
                isLocked
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
              {isLocked ? 'INTERFACE VERROUILLÉE' : 'MODIFICATION AUTORISÉE'}
            </button>
            <button
              onClick={saveMapping}
              disabled={isSaving || isLocked}
              className="h-11 px-8 bg-blue-600 hover:bg-blue-500 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-3 italic disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isSaving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'SAUVEGARDE...' : 'DÉPLOYER MAPPING'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* 🔧 Mapping Grid */}
          <div className="lg:col-span-8 space-y-12">
            {TARGET_FIELDS.map((section, sIdx) => (
              <div key={sIdx} className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <span className="h-[2px] w-8 bg-blue-500/30" />
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] italic">
                    {section.section}
                  </h3>
                </div>

                <div className="space-y-3">
                  {section.fields.map((field) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-6 rounded-[2rem] border transition-all group ${
                        isLocked
                          ? 'bg-slate-900/20 border-white/5 opacity-70'
                          : 'bg-slate-900/40 border-slate-800 hover:border-blue-500/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 border rounded-2xl flex items-center justify-center transition-all ${
                              isLocked
                                ? 'bg-white/5 border-white/5 text-slate-600'
                                : 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white'
                            }`}
                          >
                            <field.icon size={20} />
                          </div>
                          <div>
                            <h4 className="text-[13px] font-black text-white uppercase italic tracking-tight">
                              {field.label}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                ID: {field.id}
                              </span>
                              {field.required && (
                                <span className="text-[9px] font-black text-rose-500/80 uppercase tracking-widest bg-rose-500/5 px-2 py-0.5 rounded-full border border-rose-500/10">
                                  CRITIQUE
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 flex items-center gap-4 max-w-sm">
                          <div className="shrink-0 text-slate-700">
                            <Link2 size={16} />
                          </div>
                          <input
                            type="text"
                            placeholder="Nom du champ dans Kobo..."
                            value={config.kobo_field_mapping?.[field.id] || ''}
                            onChange={(e) => handleMapChange(field.id, e.target.value)}
                            readOnly={isLocked}
                            className={`w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white font-mono text-xs placeholder:text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${
                              isLocked
                                ? 'cursor-not-allowed opacity-50'
                                : 'focus:border-blue-500/50 shadow-inner'
                            }`}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 📊 Sidebar Info */}
          <div className="lg:col-span-4 space-y-8">
            <div className="p-8 bg-indigo-500/5 border border-indigo-500/10 rounded-[3rem] space-y-6 sticky top-8">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.4em] flex items-center gap-3 italic">
                <Info size={16} /> Guide des Champs
              </h3>

              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-white/5 space-y-3">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    ⚠️ Conseil d'isolation
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Si ce projet utilise un nouveau formulaire Kobo, sélectionnez-le ci-dessus.
                    <br />
                    <br />
                    <strong>
                      N'utilisez "Global" que pour les champs communs à toute l'organisation.
                    </strong>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-[10px] shrink-0">
                      01
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Format : <strong>nom_du_champ</strong> ou <strong>groupe/champ</strong> pour
                      les questions imbriquées.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-[10px] shrink-0">
                      02
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Les champs "Validation" doivent correspondre à des questions de type{' '}
                      <strong>select_one</strong> ou <strong>acknowledge</strong> dans Kobo.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                    Dernière Modif : {lastSync}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
