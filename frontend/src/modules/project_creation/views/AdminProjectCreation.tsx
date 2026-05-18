import { useState, useEffect, useMemo } from 'react';
import { projectService } from '../../../services/projectService';
import { buildProjectCreationPayload, validateProjectCreation } from '../../../utils/projectValidators';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useProject } from '../../../contexts/ProjectContext';
import { normalizeRole, ROLES } from '../../../core/security/permissions';
import { db } from '../../../store/db';
import logger from '../../../utils/logger';
import toast from 'react-hot-toast';
import { PageContainer, PageHeader, ContentArea } from '../../../components';
import * as LucideIcons from 'lucide-react';
import {
  Building2,
  Users,
  Settings,
  Plus,
  Save,
  X,
  Eye,
  Target,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Shield,
  Wrench,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  ClipboardList,
  Calculator,
  Calendar,
  MessagesSquare,
  Truck,
  Globe,
  Briefcase,
  Layers,
  Database,
  Droplets,
  Leaf,
  Heart,
  BookOpen,
  Activity,
  ShieldCheck,
  Package,
  Cpu,
  Navigation,
  Scale,
  LifeBuoy,
  ChevronRight,
  Info,
  Brain,
  WifiOff,
  Search,
  ArrowLeft,
  HelpCircle,
} from 'lucide-react';
import { COUNTRY_PACKS } from '../../../config/packs/countryPacks';
import { SECTOR_PACKS } from '../../../config/packs/sectorPacks';
import { MODULE_REGISTRY, getAllModules } from '../../../core/kernel/registry';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  client: string;
  defaultModules: string[];
  defaultUsers: string[];
  defaultSettings: Record<string, any>;
  defaultLabels?: Record<string, any>;
  defaultFields?: { id: string; label: string; type: string }[];
  icon: string;
  category: 'energy' | 'infrastructure' | 'agriculture' | 'health' | 'governance' | 'supply_chain';
  entities: string[];
}

interface ProjectFeature {
  id: string;
  name: string;
  description: string;
  icon: any;
  module: string;
  enabled: boolean;
  required?: boolean;
  tags?: string[];
}

const DEFAULT_PROJECT_TEMPLATES: ProjectTemplate[] = [
  // --- ÉNERGIE ---
  {
    id: 'elec_bt',
    name: "GED Énergie BT",
    description: "Raccordements clients, compteurs et maintenance basse tension.",
    client: 'SOCIÉTÉ ÉLEC / AGER',
    defaultModules: ['dashboard', 'terrain', 'mission', 'logistique', 'approbation'],
    defaultUsers: ['ADMIN', 'INGENIEUR_BT'],
    defaultSettings: { sector: 'elec_bt' },
    icon: 'Zap',
    category: 'energy',
    entities: ['Abonnés', 'Compteurs', 'Postes BT'],
  },
  {
    id: 'agri',
    name: "GED Agro",
    description: "Parcelles agricoles, irrigation et coopératives villageoises.",
    client: 'MINISTÈRE AGRI / ONG',
    defaultModules: ['dashboard', 'terrain', 'mission', 'planning'],
    defaultSettings: { sector: 'agri' },
    icon: 'Leaf',
    category: 'agriculture',
    entities: ['Parcelles', 'Producteurs', 'Coopératives'],
  },
  {
    id: 'health',
    name: "GED Santé",
    description: "Campagnes de vaccination, dossiers patients et gestion district.",
    client: 'MINISTÈRE SANTÉ / OMS',
    defaultModules: ['dashboard', 'terrain', 'mission', 'communication'],
    defaultSettings: { sector: 'health' },
    icon: 'Heart',
    category: 'health',
    entities: ['Patients', 'Médecins', 'Centres Santé'],
  },
  {
    id: 'gov',
    name: "GED Gouvernance",
    description: "Digitalisation administrative, workflows et reporting État.",
    client: 'PRÉSIDENCE / MINISTÈRE',
    defaultModules: ['dashboard', 'mission', 'approbation', 'communication'],
    defaultSettings: { sector: 'gov', mode: 'gov' },
    icon: 'Briefcase',
    category: 'governance',
    entities: ['Dossiers', 'Agents', 'Directions'],
  },
  // --- INFRASTRUCTURE & EAU ---
  {
    id: 'infra_eau',
    name: "GED Eau & Assais.",
    description: "Forages, réseaux d'adduction d'eau et assainissement rural.",
    client: "MINISTÈRE DE L'EAU",
    defaultModules: ['dashboard', 'terrain', 'mission', 'logistique', 'approbation'],
    defaultUsers: ['ADMIN', 'INGENIEUR_HYDRAULIQUE'],
    defaultSettings: { sector: 'infra_eau' },
    icon: 'Droplets',
    category: 'infrastructure',
    entities: ['Forages', "Châteaux d'eau", 'Réseaux'],
  },
  {
    id: 'infra_btp',
    name: "GED BTP & Routes",
    description: "Suivi de chantiers routiers, ouvrages d'art et bâtiments publics.",
    client: 'MINISTÈRE DES INFRA. / AGEROUTE',
    defaultModules: ['dashboard', 'terrain', 'mission', 'planning', 'logistique'],
    defaultUsers: ['ADMIN', 'CHEF_CHANTIER'],
    defaultSettings: { sector: 'infra_btp' },
    icon: 'Building2',
    category: 'infrastructure',
    entities: ['Chantiers', 'Ouvrages', 'Engins'],
  },
];

// Dynamically generate PROJECT_FEATURES from the core registry
const GET_CORE_FEATURES = (): ProjectFeature[] => {
  return getAllModules()
    .filter(m => m.category === 'PILOTAGE' || m.category === 'OPÉRATIONS')
    .filter(m => m.key !== 'home' && m.key !== 'help')
    .map(m => ({
      id: m.key,
      name: m.name,
      description: m.description,
      icon: (LucideIcons as any)[m.icon] || HelpCircle,
      module: m.key,
      enabled: m.required || false,
      required: m.required,
      tags: m.tags || []
    }));
};


export default function AdminProjectCreation() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { refreshProjects, setActiveProjectId } = useProject();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [complexity, setComplexity] = useState<'essential' | 'advanced'>('essential');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    client: '',
    country: 'SN',
    mode: 'enterprise' as 'enterprise' | 'gov' | 'ong' | 'bailleur',
    budget: 0,
    startDate: new Date(),
    customFields: [] as { id: string; label: string; type: string }[],
    labels: {} as Record<string, any>,
  });

  const [selectedFeatures, setSelectedFeatures] = useState<ProjectFeature[]>(GET_CORE_FEATURES());

  // 🧠 SCORE D'ARCHITECTURE & ANALYSE
  const architectureAnalysis = useMemo(() => {
    const activeModules = selectedFeatures.filter(f => f.enabled).map(f => f.module);
    let score = 70; // Base score
    const points: string[] = [];
    const warnings: string[] = [];

    if (activeModules.includes('terrain')) {
      score += 10;
      points.push("Moteur SIG activé");
    }
    
    if (activeModules.includes('mission') && !activeModules.includes('terrain')) {
      score -= 15;
      warnings.push("Missions sans support Terrain (SIG recommandé)");
    }

    if (activeModules.includes('logistique')) {
      score += 5;
      points.push("Gestion des stocks intégrée");
    }

    if (activeModules.includes('simulation') || activeModules.includes('dashboard')) {
      score += 10;
      points.push("Analytique & IA activés");
    }

    if (activeModules.length < 3) {
      score -= 10;
      warnings.push("Architecture minimale (risque de manque de données)");
    }

    return { 
      score: Math.min(100, Math.max(0, score)), 
      points, 
      warnings,
      isIAReady: activeModules.includes('simulation') || activeModules.includes('dashboard'),
      isOfflineReady: activeModules.includes('terrain'),
    };
  }, [selectedFeatures]);

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setProjectData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      client: template.client,
      labels: template.defaultLabels || {},
      customFields: template.defaultFields || [],
    }));

    setSelectedFeatures(GET_CORE_FEATURES().map(f => ({
      ...f,
      enabled: template.defaultModules.includes(f.module) || f.required
    })));
    setStep(2);
  };

  const handleCreateProject = async () => {
    const validationError = validateProjectCreation(projectData, selectedFeatures);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const payload = buildProjectCreationPayload(projectData, selectedFeatures, selectedTemplate?.id, complexity);
      const newProject = await projectService.createProject(payload);

      await refreshProjects(newProject.id);
      setActiveProjectId(newProject.id);

      toast.success('Écosystème GED OS initialisé avec succès');
      navigate('/dashboard');
    } catch (err: any) {
      console.error('FULL CREATE PROJECT ERROR:', err);
      const message = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Initialisation échouée';
      toast.error(`Erreur: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      <PageHeader
        backLink={{ to: '/admin/hub', label: 'Retour au Centre de Contrôle' }}
        title="Initialisation Écosystème"
        subtitle="GED OS Enterprise Suite v4.0 — Générateur de Plateforme"
        icon={<Plus size={32} className="text-white" strokeWidth={3} />}
        actions={
          <div className="flex items-center gap-3 p-1.5 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
            <button
              onClick={() => setComplexity('essential')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${complexity === 'essential' ? 'bg-white/10 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
            >
              ESSENTIEL
            </button>
            <button
              onClick={() => setComplexity('advanced')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${complexity === 'advanced' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Zap size={14} /> AVANCÉ
            </button>
          </div>
        }
      />

      <ContentArea className="relative max-w-[1400px] mx-auto px-0 py-6 !bg-transparent border-none">


        {step === 1 ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'all', label: 'Tous les Domaines', icon: Layers },
                { id: 'energy', label: 'Énergie', icon: Zap },
                { id: 'infrastructure', label: 'Infrastructure & Eau', icon: Droplets },
                { id: 'agriculture', label: 'Agriculture', icon: Leaf },
                { id: 'health', label: 'Social & Santé', icon: Heart },
                { id: 'governance', label: 'Gouvernance & État', icon: Briefcase },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 border-blue-500 shadow-xl scale-105'
                      : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/10 hover:text-white'
                  }`}
                >
                  <cat.icon size={16} />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {DEFAULT_PROJECT_TEMPLATES
                .filter(t => selectedCategory === 'all' || t.category === selectedCategory)
                .map(template => {
                  const Icon = (LucideIcons as any)[template.icon] || Zap;
                  return (
                    <motion.button
                      key={template.id}
                      whileHover={{ y: -8, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleTemplateSelect(template)}
                      className="group relative p-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] text-left hover:border-blue-500/40 transition-all overflow-hidden flex flex-col h-full"
                    >
                      <div className="absolute top-0 right-0 p-8 text-white/[0.03] group-hover:text-blue-500/10 transition-colors">
                        <Icon size={140} strokeWidth={1} />
                      </div>

                      <div className="mb-8 w-14 h-14 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-[1.25rem] flex items-center justify-center text-blue-400 border border-blue-500/10">
                        <Icon size={28} />
                      </div>

                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{template.category}</span>
                        <div className="h-1 w-1 rounded-full bg-slate-700" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Prêt</span>
                      </div>

                      <h3 className="text-xl font-black mb-3 text-white group-hover:text-blue-400 transition-colors leading-tight">
                        {template.name}
                      </h3>
                      
                      <p className="text-sm text-slate-400 line-clamp-3 mb-8 leading-relaxed flex-1 italic font-medium">
                        "{template.description}"
                      </p>

                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {template.entities.map(e => (
                            <span key={e} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                              {e}
                            </span>
                          ))}
                        </div>
                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-500">{template.client}</span>
                          <ChevronRight size={16} className="text-slate-700 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in fade-in slide-in-from-right-4 duration-700">
            {/* Main Config Column */}
            <div className="lg:col-span-8 space-y-10">
              <section className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-8 shadow-2xl backdrop-blur-3xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">
                      <Settings size={22} />
                    </div>
                    Paramètres de l'Écosystème
                  </h2>
                  <StatusBadge status="active" label={selectedTemplate?.name || 'Personnalisé'} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                      <FileText size={12} /> Nom du Projet
                    </label>
                    <input
                      value={projectData.name}
                      onChange={e => setProjectData(p => ({ ...p, name: e.target.value }))}
                      placeholder="Ex: Électrification Nord 2026"
                      className="w-full bg-slate-800/50 border border-white/5 p-4 rounded-2xl focus:ring-2 ring-blue-500 outline-none font-bold text-white transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                      <Globe size={12} /> Pays & Juridiction
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.values(COUNTRY_PACKS).map(cp => (
                        <button
                          key={cp.id}
                          onClick={() => setProjectData(p => ({ ...p, country: cp.id }))}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${projectData.country === cp.id ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/[0.08]'}`}
                        >
                          <span className="text-xl">{cp.flag}</span>
                          <span className="text-[10px] font-black uppercase">{cp.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label htmlFor="project-mode" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                      <Target size={12} /> Mode de Gouvernance
                    </label>
                    <select
                      id="project-mode"
                      aria-label="Mode de gouvernance"
                      title="Mode de gouvernance"
                      value={projectData.mode}
                      onChange={e => setProjectData(p => ({ ...p, mode: e.target.value as any }))}
                      className="w-full bg-slate-800/50 border border-white/5 p-4 rounded-2xl outline-none font-bold text-white"
                    >
                      <option value="enterprise">🏢 Mode Entreprise (ROI & Performance)</option>
                      <option value="gov">🏛️ Mode Gouvernement (Souveraineté)</option>
                      <option value="ong">🤝 Mode ONG (Impact & Bénéficiaires)</option>
                      <option value="bailleur">🌍 Mode Bailleur (BM / BAD / UE)</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label htmlFor="project-client" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                       Client / Organisation
                    </label>
                    <input
                      id="project-client"
                      aria-label="Client ou organisation"
                      title="Client ou organisation"
                      placeholder="Nom du client ou de l'organisation"
                      value={projectData.client}
                      onChange={e => setProjectData(p => ({ ...p, client: e.target.value }))}
                      className="w-full bg-slate-800/50 border border-white/5 p-4 rounded-2xl"
                    />
                  </div>
                </div>
              </section>

              {complexity === 'advanced' && (
                <section className="p-10 bg-indigo-500/5 border border-indigo-500/10 rounded-[3rem] space-y-8 animate-in zoom-in-95 duration-500">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400">
                        <Database size={22} />
                      </div>
                      Concepteur de Données Métier
                    </h2>
                    <span className="px-3 py-1 rounded-full bg-indigo-400/10 text-[10px] font-black text-indigo-400 uppercase tracking-widest">Low-Code Engine</span>
                  </div>
                  
                  <div className="space-y-4">
                    {projectData.customFields.map((field, i) => (
                      <div key={i} className="flex gap-4 p-5 bg-white/5 border border-white/5 rounded-[1.5rem] items-center">
                        <div className="flex-1">
                          <input
                            title={field.label ? `Champ métier: ${field.label}` : `Champ métier ${i + 1}`}
                            value={field.label}
                            onChange={e => {
                              const f = [...projectData.customFields];
                              f[i].label = e.target.value;
                              f[i].id = e.target.value.toLowerCase().replace(/ /g, '_');
                              setProjectData(p => ({ ...p, customFields: f }));
                            }}
                            className="w-full bg-transparent border-none outline-none font-bold text-white text-lg"
                            placeholder="Nom du champ..."
                          />
                        </div>
                        <select 
                          aria-label={`Type du champ ${field.label || i + 1}`}
                          title={`Type du champ ${field.label || i + 1}`}
                          value={field.type}
                          onChange={e => {
                            const f = [...projectData.customFields];
                            f[i].type = e.target.value;
                            setProjectData(p => ({ ...p, customFields: f }));
                          }}
                          className="bg-transparent text-slate-500 text-xs font-black uppercase"
                        >
                          <option value="text">Texte</option>
                          <option value="number">Nombre</option>
                          <option value="date">Date</option>
                          <option value="select">Liste</option>
                        </select>
                        <button 
                          aria-label="Supprimer le champ"
                          title="Supprimer le champ"
                          onClick={() => setProjectData(p => ({ ...p, customFields: p.customFields.filter((_, idx) => idx !== i) }))}
                          className="p-2 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                    
                    <button
                      onClick={() => setProjectData(p => ({ ...p, customFields: [...p.customFields, { id: 'new', label: 'Nouveau Champ', type: 'text' }] }))}
                      className="w-full p-6 border-2 border-dashed border-white/5 rounded-[1.5rem] text-slate-500 hover:text-white hover:border-indigo-500/30 transition-all font-bold text-sm"
                    >
                      + Ajouter une variable spécifique au domaine
                    </button>
                  </div>
                </section>
              )}

              {/* 🧩 DIAGRAMME DE FLUX (DYNAMIC) */}
              <section className="p-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] space-y-6">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Architecture du Flux de Données</h2>
                <div className="flex items-center justify-center gap-4 py-4">
                  {selectedFeatures.filter(f => f.enabled).map((f, i, arr) => (
                    <div key={f.id} className="flex items-center gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
                        <f.icon size={20} className="text-blue-400" />
                        <span className="text-[8px] font-black uppercase text-slate-500">{f.name}</span>
                      </div>
                      {i < arr.length - 1 && <ChevronRight size={20} className="text-slate-800" />}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Strategic Summary Sidebar */}
            <div className="lg:col-span-4 space-y-8">
              <aside className="sticky top-12 p-8 bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 rounded-[3rem] shadow-2xl space-y-10">
                {/* Architecture Score */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Score Architecture</span>
                    <span className={`text-2xl font-black ${architectureAnalysis.score > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{architectureAnalysis.score}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${architectureAnalysis.score}%` }}
                      className={`h-full bg-gradient-to-r ${architectureAnalysis.score > 80 ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-orange-500'}`} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    {architectureAnalysis.points.map(p => (
                      <div key={p} className="flex items-center gap-2 text-[10px] font-bold text-emerald-400">
                        <CheckCircle2 size={12} /> {p}
                      </div>
                    ))}
                    {architectureAnalysis.warnings.map(w => (
                      <div key={w} className="flex items-center gap-2 text-[10px] font-bold text-amber-400">
                        <AlertTriangle size={12} /> {w}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Intelligent Summary */}
                <div className="space-y-6 pt-10 border-t border-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Résumé GED OS</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <SummaryItem label="Domaine" value={selectedTemplate?.category || 'Expert'} />
                    <SummaryItem label="Mode" value={projectData.mode.toUpperCase()} />
                    <SummaryItem label="Modules" value={selectedFeatures.filter(f => f.enabled).length} />
                    <SummaryItem label="Pays" value={projectData.country} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {architectureAnalysis.isIAReady && <Badge label="IA READY" color="blue" icon={Brain} />}
                    {architectureAnalysis.isOfflineReady && <Badge label="OFFLINE-FIRST" color="emerald" icon={WifiOff} />}
                    <Badge label="ENTERPRISE" color="slate" icon={ShieldCheck} />
                  </div>
                </div>

                {/* Module Selection (Simplified for Summary) */}
                <div className="space-y-4 pt-10 border-t border-white/5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Modules Actifs</h3>
                  <div className="space-y-2">
                    {selectedFeatures.map(feature => (
                      <button
                        key={feature.id}
                        onClick={() => !feature.required && setSelectedFeatures(prev => prev.map(f => f.id === feature.id ? { ...f, enabled: !f.enabled } : f))}
                        className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${
                          feature.enabled ? 'bg-white/10 border-white/10 text-white' : 'bg-transparent border-transparent text-slate-600 grayscale'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <feature.icon size={18} />
                          <span className="text-[11px] font-black uppercase tracking-tighter">{feature.name}</span>
                        </div>
                        {feature.tags?.includes('IA') && <Zap size={12} className="text-blue-500" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-10">
                  <button
                    disabled={loading || !projectData.name}
                    onClick={handleCreateProject}
                    className="group relative w-full p-6 bg-blue-600 rounded-[2rem] font-black text-xl hover:bg-blue-500 transition-all shadow-[0_20px_60px_rgba(37,99,235,0.3)] disabled:opacity-30 disabled:grayscale overflow-hidden"
                  >
                    <div className="relative z-10 flex items-center justify-center gap-3">
                      {loading ? <Clock className="animate-spin" /> : <Plus size={24} strokeWidth={3} />}
                      {loading ? 'INITIALISATION...' : 'LANCER L\'ÉCOSYSTÈME'}
                    </div>
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    />
                  </button>
                  <button onClick={() => setStep(1)} className="w-full text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white transition-colors">
                    ← Revenir au catalogue
                  </button>
                </div>
              </aside>
            </div>
          </div>
        )}
      </ContentArea>
    </PageContainer>
  );
}

// 🎨 SUB-COMPONENTS UI
function SummaryItem({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{label}</p>
      <p className="text-xs font-black text-white truncate">{value}</p>
    </div>
  );
}

function Badge({ label, color, icon: Icon }: { label: string; color: string; icon: any }) {
  const colors: any = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-widest ${colors[color]}`}>
      <Icon size={12} />
      {label}
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5">
      <div className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`} />
      <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">{label}</span>
    </div>
  );
}
