/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Filter,
  Calendar,
  MapPin,
  CheckCircle2,
  BarChart3,
  Search,
  ChevronDown,
  TrendingUp,
  Package,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { useAuth } from '../contexts/AuthContext';
import { useFinances } from '../hooks/useFinances';
import {
  generateRapportAvancement,
  generateRapportFinancier,
  generateRapportLogistique,
  generateRapportKobo,
} from '../services/reportGenerator';

// Import centralized design system
import {
  PageContainer,
  PageHeader,
  Section,
  CardGrid,
  ContentArea,
  COMMON_CLASSES,
} from '../components';

import { useLabels } from '../contexts/LabelsContext';

type GenerationState = Record<string, 'idle' | 'loading' | 'done' | 'error'>;

interface ReportCard {
  id: string;
  title: string;
  desc: string;
  type: 'PDF' | 'Excel' | 'CSV';
  icon: typeof FileText;
  color: string;
  textColor: string;
  lseVisible: boolean;
  roles: string[];
  handler: () => Promise<void>;
  preview: string[];
}

export default function Reports() {
  const [searchTerm, setSearchTerm] = useState('');
  const [states, setStates] = useState<GenerationState>({});
  const households = useLiveQuery(() => db.households.toArray()) || [];
  const zones = useLiveQuery(() => db.zones.toArray()) || [];
  const { user } = useAuth();
  const { getLabel } = useLabels();
  const isLSE = user?.role === 'CLIENT_LSE';
  const isAdmin = user?.role === 'ADMIN_PROQUELEC' || user?.role === 'DG_PROQUELEC';
  const finances = useFinances();
  const [exportFormat, setExportFormat] = useState('PDF');
  const [includeFinancial, setIncludeFinancial] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(true);

  const markState = (id: string, state: 'loading' | 'done' | 'error') =>
    setStates((s) => ({ ...s, [id]: state }));

  const run = async (id: string, fn: () => void) => {
    markState(id, 'loading');
    await new Promise((r) => setTimeout(r, 600)); // visual delay
    try {
      fn();
      markState(id, 'done');
      setTimeout(() => setStates((s) => ({ ...s, [id]: 'idle' })), 3000);
    } catch (e) {
      markState(id, 'error');
    }
  };

  const completionRate = useMemo(() => {
    if (households.length === 0) return 0;
    const done = households.filter((h) => h.status === 'Terminé' || h.status === 'Conforme').length;
    return Math.round((done / households.length) * 100);
  }, [households]);

  const stats = useMemo(() => {
    const allStats = [
      {
        label: 'Taux de Complétion',
        value: `${completionRate}%`,
        icon: CheckCircle2,
        color: 'text-emerald-500',
        lseVisible: true,
      },
      {
        label: `${getLabel('household.plural')} Servis`,
        value: households.length.toLocaleString('fr-FR') || '0',
        icon: Calendar,
        color: 'text-blue-500',
        lseVisible: true,
      },
      {
        label: `${getLabel('zone.plural')} Actives`,
        value: zones.length || 0,
        icon: MapPin,
        color: 'text-amber-500',
        lseVisible: true,
      },
      {
        label: 'Écarts Budgétaires',
        value: finances.devis?.marginPct ? `${finances.devis.marginPct.toFixed(1)}%` : '0%',
        icon: BarChart3,
        color: 'text-indigo-500',
        lseVisible: false,
      },
    ];
    return allStats.filter((s) => !isLSE || s.lseVisible);
  }, [completionRate, households.length, zones.length, finances, isLSE, getLabel]);

  const reportCards: ReportCard[] = [
    {
      id: 'avancement',
      title: "Rapport Journalier d'Avancement",
      desc: 'Progression par région, pipeline des équipes, tableau des derniers raccordements validés.',
      type: 'PDF',
      icon: TrendingUp,
      color: 'bg-indigo-500/10 border-indigo-500/30',
      textColor: 'text-indigo-400',
      lseVisible: true,
      roles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC', 'CLIENT_LSE', 'CHEF_EQUIPE'],
      preview: [
        'Avancement global (%)',
        'Progression par région',
        'Pipeline sous-équipes',
        'Tableau des validations',
      ],
      handler: async () => {
        generateRapportAvancement({
          households,
          zones,
          projectName: 'Projet GEM — Sénégal',
          userName: user?.name,
        });
      },
    },
    {
      id: 'financier',
      title: 'Analyse Économique Complète',
      desc: 'Devis vs Réel, marges par poste, décomposition des coûts, budget vs plafond.',
      type: 'PDF',
      icon: BarChart3,
      color: 'bg-emerald-500/10 border-emerald-500/30',
      textColor: 'text-emerald-400',
      lseVisible: false,
      roles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'],
      preview: [
        'Marge globale (FCFA)',
        'Tableau Devis vs Réel',
        'Comparatif Budget/Plafond',
        'Coûts Équipes + Matériaux',
      ],
      handler: async () => {
        if (!isAdmin) return;
        generateRapportFinancier({
          devisReport: finances.devis?.report || [],
          totalPlanned: finances.devis?.totalPlanned || 0,
          totalReal: finances.devis?.totalReal || 0,
          globalMargin: finances.devis?.globalMargin || 0,
          marginPct: finances.devis?.marginPct || 0,
          ceiling: finances.devis?.ceiling || 300823750,
          stats: finances.stats,
          projectName: 'Projet GEM — Sénégal',
        });
      },
    },
    {
      id: 'logistique',
      title: 'Bilan Logistique & Matériel',
      desc: 'État des stocks de kits, consommation par région, planning des prochaines livraisons.',
      type: 'PDF',
      icon: Package,
      color: 'bg-amber-500/10 border-amber-500/30',
      textColor: 'text-amber-400',
      lseVisible: false,
      roles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'],
      preview: [
        'Kits chargés / livrés / posés',
        'Conso. matériaux par région',
        'Planning livraisons à venir',
      ],
      handler: async () => {
        generateRapportLogistique({ households, zones });
      },
    },
    {
      id: 'kobo',
      title: 'Rapport de Validation Kobo',
      desc: 'Taux de synchronisation, journal des pulls/push, erreurs et doublons — usage interne uniquement.',
      type: 'PDF',
      icon: RefreshCw,
      color: 'bg-blue-500/10 border-blue-500/30',
      textColor: 'text-blue-400',
      lseVisible: false,
      roles: ['ADMIN_PROQUELEC', 'DG_PROQUELEC'],
      preview: ['Taux sync par formulaire', 'Journal des opérations', 'Erreurs / Doublons'],
      handler: async () => {
        generateRapportKobo({ households });
      },
    },
  ];

  const visible = reportCards.filter((r) => {
    const roleOk = r.roles.includes(user?.role ?? '');
    const lseOk = !isLSE || r.lseVisible;
    const search =
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.desc.toLowerCase().includes(searchTerm.toLowerCase());
    return roleOk && lseOk && (searchTerm === '' || search);
  });

  const typeColor = (t: string) =>
    t === 'PDF'
      ? 'bg-red-500/10 text-red-400'
      : t === 'Excel'
        ? 'bg-emerald-500/10 text-emerald-400'
        : 'bg-blue-500/10 text-blue-400';

  return (
    <PageContainer>
      <PageHeader
        title="Rapports & Analyses"
        subtitle="Intelligence Opérationnelle & Exports"
        icon={FileText}
        actions={
          <div className="flex items-center gap-3 flex-1 md:max-w-md">
            <div className="relative flex-1 group">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300/50 group-focus-within:text-blue-500 transition-colors"
                size={16}
              />
              <input
                type="text"
                placeholder="Rechercher un rapport..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${COMMON_CLASSES.input} pl-10 bg-slate-900/50 border-white/5 focus:border-blue-500`}
              />
            </div>
            <button aria-label="Filtrer" className={`${COMMON_CLASSES.btnSecondary} p-2.5`}>
              <Filter size={18} />
            </button>
          </div>
        }
      />

      <Section title="Indicateurs de Performance">
        <CardGrid columns={4}>
          {stats.map((stat, i) => (
            <div key={i} className={`${COMMON_CLASSES.card} ${COMMON_CLASSES.cardHover} p-6 group`}>
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform`}
                >
                  <stat.icon size={20} />
                </div>
                <span className="text-xs font-black text-blue-300/40 uppercase tracking-widest">
                  {stat.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-white tracking-tight">{stat.value}</p>
                <TrendingUp size={14} className="text-emerald-500 opacity-50" />
              </div>
            </div>
          ))}
        </CardGrid>
      </Section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2">
          <Section title="Modèles Disponibles" subtitle={`${visible.length} RAPPORTS TROUVÉS`}>
            <CardGrid columns={2}>
              {visible.map((report) => {
                const state = states[report.id] || 'idle';
                const Icon = report.icon;
                return (
                  <div
                    key={report.id}
                    className={`${COMMON_CLASSES.card} ${COMMON_CLASSES.cardHover} p-8 group relative`}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div
                        className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${report.textColor} group-hover:scale-110 transition-transform shadow-inner`}
                      >
                        <Icon size={28} />
                      </div>
                      <span
                        className={`text-xs font-black px-3 py-1.5 rounded-lg ${typeColor(report.type)} uppercase tracking-widest`}
                      >
                        {report.type}
                      </span>
                    </div>

                    <h4
                      className={`${COMMON_CLASSES.heading3} mb-2 text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight`}
                    >
                      {report.title}
                    </h4>
                    <p className="text-blue-200/60 text-sm leading-relaxed mb-6">{report.desc}</p>

                    <div className="space-y-2 mb-8 bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-xs font-black text-blue-300/40 uppercase tracking-widest mb-2">
                        Inclus dans l'export :
                      </p>
                      {report.preview.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-xs font-bold text-blue-100/80"
                        >
                          <div
                            className={`w-1 h-1 rounded-full ${report.textColor.replace('text-', 'bg-')}`}
                          />
                          {p}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => run(report.id, report.handler)}
                      disabled={state === 'loading'}
                      className={`w-full py-4 font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 text-xs uppercase tracking-widest
                                                ${
                                                  state === 'done'
                                                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                                                    : state === 'error'
                                                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-none'
                                                      : COMMON_CLASSES.btnPrimary
                                                }`}
                    >
                      {state === 'loading' ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Génération...
                        </>
                      ) : state === 'done' ? (
                        <>
                          <CheckCircle2 size={16} /> Prêt !
                        </>
                      ) : state === 'error' ? (
                        'Échec — Réessayer'
                      ) : (
                        <>
                          <Download size={16} /> Télécharger
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </CardGrid>
          </Section>
        </div>

        <div className="xl:col-span-1">
          <Section title="Export Avancé" subtitle="Paramétrez votre extraction de données terrain.">
            <ContentArea className="bg-[#0D1E35] border-white/5">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className={COMMON_CLASSES.label} htmlFor="export-format">
                    Format du fichier
                  </label>
                  <div className="relative">
                    <select
                      id="export-format"
                      title="Choisir le format d'export"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value)}
                      className={`${COMMON_CLASSES.input} appearance-none pr-10 bg-slate-900 border-white/10 text-white`}
                    >
                      <option value="PDF">PDF Document (.pdf)</option>
                      <option value="Excel">Excel Spreadsheet (.xlsx)</option>
                    </select>
                    <ChevronDown
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-blue-300/30 pointer-events-none"
                      size={18}
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-4">
                  <label
                    className="flex items-center gap-4 cursor-pointer group"
                    onClick={() => setIncludeSummary((v) => !v)}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${includeSummary ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'}`}
                    >
                      {includeSummary && <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />}
                    </div>
                    <span className="text-blue-100 font-bold text-xs uppercase tracking-tight">
                      Résumé Avancement Terrain
                    </span>
                  </label>
                  {isAdmin && (
                    <label
                      className="flex items-center gap-4 cursor-pointer group"
                      onClick={() => setIncludeFinancial((v) => !v)}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center ${includeFinancial ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 group-hover:border-emerald-500'}`}
                      >
                        {includeFinancial && (
                          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                        )}
                      </div>
                      <span className="font-bold text-xs uppercase tracking-tight text-blue-100">
                        Données Financières (Devis vs Réel)
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div
                className={`flex items-center gap-4 p-5 rounded-3xl border text-xs font-bold leading-relaxed mt-8
                                ${
                                  isAdmin
                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                    : isLSE
                                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                }`}
              >
                <ShieldCheck size={20} className="shrink-0" />
                <div>
                  <span className="uppercase text-xs font-black opacity-60">Permissions :</span>
                  <br />
                  {isAdmin
                    ? 'Contrôle Total — Accès expert au hub financier & Kobo.'
                    : isLSE
                      ? "Mode Client — Données d'avancement certifiées uniquement."
                      : 'Mode Opérationnel — Rapports terrain et logistique.'}
                </div>
              </div>

              <button
                onClick={() => {
                  if (includeFinancial && isAdmin) {
                    run('global', () =>
                      generateRapportFinancier({
                        devisReport: finances.devis?.report || [],
                        totalPlanned: finances.devis?.totalPlanned || 0,
                        totalReal: finances.devis?.totalReal || 0,
                        globalMargin: finances.devis?.globalMargin || 0,
                        marginPct: finances.devis?.marginPct || 0,
                        ceiling: finances.devis?.ceiling || 300823750,
                        stats: finances.stats,
                        projectName: 'Projet GEM — Sénégal',
                      })
                    );
                  } else {
                    run('global', () =>
                      generateRapportAvancement({ households, zones, userName: user?.name })
                    );
                  }
                }}
                disabled={states['global'] === 'loading'}
                className={`${COMMON_CLASSES.btnPrimary} w-full py-5 rounded-[1.5rem] mt-6 text-xs uppercase tracking-[0.2em] shadow-blue-500/20`}
              >
                {states['global'] === 'loading' ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" /> Extraction...
                  </>
                ) : (
                  <>
                    <Download size={18} /> Lancer l'Export
                  </>
                )}
              </button>
            </ContentArea>
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}
