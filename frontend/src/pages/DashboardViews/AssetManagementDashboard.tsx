import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../store/db';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Package,
  Wrench,
  AlertTriangle,
  FileText,
  TrendingUp,
  Activity,
  Settings,
  BarChart3,
  Clock,
  MapPin,
  CheckCircle2,
  Truck,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../../components';
import {
  DASHBOARD_ACTION_TILE_PRIMARY,
  DASHBOARD_ACTION_TILE_SECONDARY,
  DASHBOARD_MINI_STAT_CARD,
  DASHBOARD_PRIMARY_BUTTON,
  DASHBOARD_STICKY_PANEL,
  StatusBadge,
  KPICard,
  ProgressBar,
} from '../../components/dashboards/DashboardComponents';
import { fmtNum } from '../../utils/format';

interface AssetMetrics {
  // Patrimoine global
  totalAssets: number;
  assetsActifs: number;
  assetsMaintenance: number;
  assetsHorsService: number;

  // Valeur patrimoniale
  valeurTotale: number;
  valeurActifs: number;
  amortissementCumule: number;
  valeurNetComptable: number;

  // Maintenance
  interventionsPlanifiees: number;
  interventionsUrgentes: number;
  tempsMoyenIntervention: number;
  coutMaintenanceMensuel: number;

  // Performance
  tauxDisponibilite: number;
  tauxPanne: number;
  ageMoyenActifs: number;
  efficaciteMaintenance: number;
}

interface AssetData {
  id: string;
  nom: string;
  type: 'equipement' | 'vehicule' | 'outillage' | 'batiment';
  statut: 'actif' | 'maintenance' | 'hors_service';
  localisation: string;
  dateAcquisition: Date;
  valeurAcquisition: number;
  valeurActuelle: number;
  derniereMaintenance?: Date;
  prochaineMaintenance?: Date;
  responsable: string;
  performance: number;
}

interface MaintenanceData {
  id: string;
  assetId: string;
  type: 'preventive' | 'corrective' | 'urgente';
  date: Date;
  cout: number;
  duree: number; // en heures
  technicien: string;
  statut: 'planifiee' | 'en_cours' | 'terminee';
  description: string;
}

const ViewSelector = ({ selectedView, setSelectedView }: { 
  selectedView: 'overview' | 'assets' | 'maintenance' | 'reports';
  setSelectedView: React.Dispatch<React.SetStateAction<'overview' | 'assets' | 'maintenance' | 'reports'>>;
}) => (
  <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
    {[
      { id: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
      { id: 'assets', label: 'Actifs', icon: Package },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench },
      { id: 'reports', label: 'Rapports', icon: FileText },
    ].map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        onClick={() => setSelectedView(id as any)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          selectedView === id
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Icon size={16} />
        {label}
      </button>
    ))}
  </div>
);

export default function AssetManagementDashboard() {
   const { user } = useAuth();
   const { peut, PERMISSIONS } = usePermissions();
   const navigate = useNavigate();
   const households = useLiveQuery(() => db.households.toArray()) || [];
   const zones = useLiveQuery(() => db.zones.toArray()) || [];

   const [selectedView, setSelectedView] = useState<
     'overview' | 'assets' | 'maintenance' | 'reports'
   >('overview');

   // Vérification des permissions
   const canViewMissions = peut(PERMISSIONS.MISSIONS_READ);
   const canViewTeams = peut(PERMISSIONS.UI_TEAMS);
   const canViewAssets = peut(PERMISSIONS.TERRAIN_MENAGES);
   const canManageLogistics = peut(PERMISSIONS.LOGISTIQUE_MANAGE);
   const canViewReports = peut(PERMISSIONS.TERRAIN_READ);
   const canExportData = peut(PERMISSIONS.SYSTEM_EXPORT);

   // Calcul des métriques patrimoniales
   const assetMetrics: AssetMetrics = useMemo(() => {
     // Simulations des métriques patrimoniales
     const totalAssets = 175; // valeur représentative — à brancher sur API
     const assetsActifs = Math.floor(totalAssets * 0.85); // 85% actifs
     const assetsMaintenance = Math.floor(totalAssets * 0.1); // 10% en maintenance
     const assetsHorsService = totalAssets - assetsActifs - assetsMaintenance;

     const valeurTotale = 55000000; // valeur représentative — à brancher sur API
     const valeurActifs = valeurTotale * 0.85;
     const amortissementCumule = valeurTotale * 0.25; // 25% amortissement
     const valeurNetComptable = valeurTotale - amortissementCumule;

     const interventionsPlanifiees = 16; // valeur représentative
     const interventionsUrgentes = 1; // valeur représentative
     const tempsMoyenIntervention = 4.5; // heures
     const coutMaintenanceMensuel = 3000000; // 3M FCFA représentatif

     const tauxDisponibilite = 95; // 95% représentatif
     const tauxPanne = 100 - tauxDisponibilite;
     const ageMoyenActifs = 4.2; // ans représentatif
     const efficaciteMaintenance = 93; // 93% représentatif

     return {
       totalAssets,
       assetsActifs,
       assetsMaintenance,
       assetsHorsService,
       valeurTotale,
       valeurActifs,
       amortissementCumule,
       valeurNetComptable,
       interventionsPlanifiees,
       interventionsUrgentes,
       tempsMoyenIntervention,
       coutMaintenanceMensuel,
       tauxDisponibilite,
       tauxPanne,
       ageMoyenActifs,
       efficaciteMaintenance,
     };
   }, []);

   // Données des actifs
   const assetsData: AssetData[] = useMemo(() => {
     return [
       {
         id: '1',
         nom: 'Groupe électrogène GE-001',
         type: 'equipement',
         statut: 'actif',
         localisation: 'Zone A - Site Principal',
         dateAcquisition: new Date('2022-01-15'),
         valeurAcquisition: 5000000,
         valeurActuelle: 4250000,
         derniereMaintenance: new Date('2024-10-15'),
         prochaineMaintenance: new Date('2025-01-15'),
         responsable: 'Technicien Alpha',
         performance: 95,
       },
       {
         id: '2',
         nom: 'Camionnette Utilitaire CU-012',
         type: 'vehicule',
         statut: 'maintenance',
         localisation: 'Atelier Central',
         dateAcquisition: new Date('2021-06-20'),
         valeurAcquisition: 8000000,
         valeurActuelle: 6400000,
         derniereMaintenance: new Date('2024-11-01'),
         prochaineMaintenance: new Date('2024-11-15'),
         responsable: 'Mécanicien Beta',
         performance: 78,
       },
       {
         id: '3',
         nom: "Kit d'Outils Électriques KO-003",
         type: 'outillage',
         statut: 'actif',
         localisation: 'Zone B - Dépôt',
         dateAcquisition: new Date('2023-03-10'),
         valeurAcquisition: 1500000,
         valeurActuelle: 1350000,
         derniereMaintenance: new Date('2024-09-20'),
         prochaineMaintenance: new Date('2025-03-20'),
         responsable: 'Équipe Gamma',
         performance: 88,
       },
       {
         id: '4',
         nom: 'Bureau Administratif BA-001',
         type: 'batiment',
         statut: 'hors_service',
         localisation: 'Siège Social',
         dateAcquisition: new Date('2020-01-01'),
         valeurAcquisition: 25000000,
         valeurActuelle: 20000000,
         derniereMaintenance: new Date('2024-08-10'),
         prochaineMaintenance: new Date('2025-02-10'),
         responsable: 'Service Technique',
         performance: 65,
       },
     ];
   }, []);

   // Données de maintenance
   const maintenanceData: MaintenanceData[] = useMemo(() => {
     return [
       {
         id: '1',
         assetId: '1',
         type: 'preventive',
         date: new Date('2025-01-15'),
         cout: 250000,
         duree: 4,
         technicien: 'Technicien Alpha',
         statut: 'planifiee',
         description: 'Maintenance préventive trimestrielle groupe électrogène',
       },
       {
         id: '2',
         assetId: '2',
         type: 'corrective',
         date: new Date('2024-11-15'),
         cout: 450000,
         duree: 8,
         technicien: 'Mécanicien Beta',
         statut: 'en_cours',
         description: 'Réparation système freinage camionnette',
       },
       {
         id: '3',
         assetId: '3',
         type: 'urgente',
         date: new Date('2024-11-10'),
         cout: 120000,
         duree: 2,
         technicien: 'Équipe Gamma',
         statut: 'terminee',
         description: 'Remplacement pince ampèremétrique défectueuse',
       },
     ];
   }, []);

   const scrollToSection = (sectionId: string) => {
     document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
   };

   return (
    <PageContainer className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-600/10 via-blue-600/5 to-transparent pointer-events-none" />

      <PageHeader
        title="TABLEAU DE BORD PATRIMOINE"
        subtitle="Gestion des actifs, maintenance et suivi patrimonial"
        icon={
          <ShieldCheck
            size={28}
            className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]"
          />
        }
        className="relative z-10 pt-6 pb-4"
      />

      <ContentArea padding="none" className="bg-transparent border-none shadow-none relative z-10">
        <div className="px-3 sm:px-6 lg:px-12 pb-16 sm:pb-24 space-y-6 sm:space-y-8 lg:space-y-12">
          {/* Header avec navigation */}
          <header className={DASHBOARD_STICKY_PANEL}>
               <div className="flex flex-col gap-4">
                 <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                   <div className="min-w-0">
                     <div className="mb-2 flex flex-wrap items-center gap-2">
                       <StatusBadge status="info" label="Gestion Patrimoine" />
                       <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em] text-blue-300/55">
                         Suivi actifs et maintenance
                       </span>
                     </div>
                     <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">
                       Console de gestion patrimoniale
                     </h2>
                     <p className="text-[13px] text-slate-400">
                       Inventaire, maintenance planifiée et optimisation des actifs.
                     </p>
                   </div>
                   <ViewSelector selectedView={selectedView} setSelectedView={setSelectedView} />
                 </div>

              {/* Actions rapides */}
              <div className="grid grid-cols-2 gap-3">
                {canManageLogistics && (
                  <button
                    onClick={() => navigate('/patrimoine/inventaire')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <Package size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Inventaire
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Gérer les actifs</p>
                      </div>
                    </div>
                  </button>
                )}
                {canManageLogistics && (
                  <button
                    onClick={() => navigate('/patrimoine/maintenance')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <Wrench size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Maintenance
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">Planifier et suivre</p>
                      </div>
                    </div>
                  </button>
                )}
                {canViewReports && (
                  <button
                    onClick={() => navigate('/rapports/patrimoine')}
                    className={DASHBOARD_ACTION_TILE_SECONDARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">
                          Rapports
                        </p>
                        <p className="mt-1 text-[12px] text-slate-400">État et analyses</p>
                      </div>
                    </div>
                  </button>
                )}
                {canExportData && (
                  <button
                    onClick={() => navigate('/patrimoine/export')}
                    className={DASHBOARD_ACTION_TILE_PRIMARY}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                        <Activity size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.06em]">Export</p>
                        <p className="mt-1 text-[12px] text-blue-100/90">Exporter les données</p>
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* KPIs principaux */}
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-3">
                  {[
                    { label: 'Actifs totaux', value: assetMetrics.totalAssets, icon: Package },
                    {
                      label: 'Valeur totale',
                      value: fmtNum(assetMetrics.valeurTotale),
                      icon: DollarSign,
                    },
                    {
                      label: 'Disponibilité',
                      value: `${assetMetrics.tauxDisponibilite.toFixed(1)}%`,
                      icon: CheckCircle2,
                    },
                    {
                      label: 'Maintenance',
                      value: assetMetrics.interventionsPlanifiees,
                      icon: Wrench,
                    },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className={DASHBOARD_MINI_STAT_CARD}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-blue-300">
                          <Icon size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.06em] text-slate-400">
                            {label}
                          </p>
                          <p className="mt-1 text-xl font-black tracking-tight text-white">
                            {value}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* Vue d'ensemble */}
          {selectedView === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* KPIs patrimoniaux */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-8">
                <KPICard
                  title="ACTIFS TOTAUX"
                  value={assetMetrics.totalAssets}
                  icon={<Package size={22} />}
                  trend={{ value: 5, isUp: true, label: 'CE TRIMESTRE' }}
                />
                <KPICard
                  title="VALEUR NETTE"
                  value={fmtNum(assetMetrics.valeurNetComptable)}
                  icon={<DollarSign size={22} />}
                  trend={{ value: 2.3, isUp: true, label: 'CE MOIS' }}
                />
                <KPICard
                  title="DISPONIBILITÉ"
                  value={`${assetMetrics.tauxDisponibilite.toFixed(1)}%`}
                  icon={<CheckCircle2 size={22} />}
                  trend={{ value: 0.5, isUp: true, label: 'AMÉLIORATION' }}
                />
                <KPICard
                  title="COÛT MAINTENANCE"
                  value={fmtNum(assetMetrics.coutMaintenanceMensuel)}
                  icon={<Wrench size={22} />}
                  trend={{ value: 1.2, isUp: false, label: 'RÉDUCTION' }}
                />
              </div>

              {/* Répartition et performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <Package size={18} className="text-blue-500" /> Répartition des Actifs
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Actifs opérationnels</span>
                      <span className="text-sm font-medium text-emerald-400">
                        {assetMetrics.assetsActifs}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">En maintenance</span>
                      <span className="text-sm font-medium text-amber-400">
                        {assetMetrics.assetsMaintenance}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Hors service</span>
                      <span className="text-sm font-medium text-red-400">
                        {assetMetrics.assetsHorsService}
                      </span>
                    </div>
                    <ProgressBar
                      label="Taux de disponibilité"
                      count={`${assetMetrics.assetsActifs} / ${assetMetrics.totalAssets} actifs`}
                      percentage={assetMetrics.tauxDisponibilite}
                      status={
                        assetMetrics.tauxDisponibilite >= 95
                          ? 'success'
                          : assetMetrics.tauxDisponibilite >= 90
                            ? 'warning'
                            : 'info'
                      }
                    />
                  </div>
                </div>

                <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                  <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                    <Activity size={18} className="text-blue-500" /> Performance Maintenance
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Efficacité maintenance</span>
                      <span className="text-sm font-medium text-white">
                        {assetMetrics.efficaciteMaintenance.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Temps moyen intervention</span>
                      <span className="text-sm font-medium text-white">
                        {assetMetrics.tempsMoyenIntervention} heures
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Âge moyen actifs</span>
                      <span className="text-sm font-medium text-white">
                        {assetMetrics.ageMoyenActifs.toFixed(1)} ans
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Interventions urgentes</span>
                      <span className="text-sm font-medium text-red-400">
                        {assetMetrics.interventionsUrgentes}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue actifs */}
          {selectedView === 'assets' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <Package size={18} className="text-blue-500" /> Inventaire des Actifs
                </h3>
                <div className="space-y-3">
                  {assetsData.map((asset) => (
                    <div
                      key={asset.id}
                      className={`p-4 rounded-lg border ${
                        asset.statut === 'actif'
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : asset.statut === 'maintenance'
                            ? 'bg-amber-500/10 border-amber-500/20'
                            : 'bg-red-500/10 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                asset.statut === 'actif'
                                  ? 'bg-emerald-500 text-white'
                                  : asset.statut === 'maintenance'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-red-500 text-white'
                              }`}
                            >
                              {asset.statut === 'actif'
                                ? 'Actif'
                                : asset.statut === 'maintenance'
                                  ? 'Maintenance'
                                  : 'Hors service'}
                            </span>
                            <span className="text-sm font-medium text-white">{asset.nom}</span>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">
                            {asset.type} • {asset.localisation} • {asset.responsable}
                          </p>
                          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                            <span>Valeur: {fmtNum(asset.valeurActuelle)}</span>
                            <span>Performance: {asset.performance}%</span>
                            <span>
                              Acquisition: {asset.dateAcquisition.toLocaleDateString('fr-FR')}
                            </span>
                            <span>
                              Prochaine maintenance:{' '}
                              {asset.prochaineMaintenance?.toLocaleDateString('fr-FR') || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue maintenance */}
          {selectedView === 'maintenance' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <Wrench size={18} className="text-blue-500" /> Plan de Maintenance
                </h3>
                <div className="space-y-3">
                  {maintenanceData.map((maintenance) => (
                    <div
                      key={maintenance.id}
                      className={`p-4 rounded-lg border ${
                        maintenance.type === 'urgente'
                          ? 'bg-red-500/10 border-red-500/20'
                          : maintenance.type === 'corrective'
                            ? 'bg-amber-500/10 border-amber-500/20'
                            : 'bg-blue-500/10 border-blue-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                maintenance.type === 'urgente'
                                  ? 'bg-red-500 text-white'
                                  : maintenance.type === 'corrective'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-blue-500 text-white'
                              }`}
                            >
                              {maintenance.type === 'urgente'
                                ? 'Urgente'
                                : maintenance.type === 'corrective'
                                  ? 'Corrective'
                                  : 'Préventive'}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                maintenance.statut === 'terminee'
                                  ? 'bg-emerald-500 text-white'
                                  : maintenance.statut === 'en_cours'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-500 text-white'
                              }`}
                            >
                              {maintenance.statut === 'terminee'
                                ? 'Terminée'
                                : maintenance.statut === 'en_cours'
                                  ? 'En cours'
                                  : 'Planifiée'}
                            </span>
                            <span className="text-sm font-medium text-white">
                              {assetsData.find((a) => a.id === maintenance.assetId)?.nom}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">
                            {maintenance.technicien} •{' '}
                            {maintenance.date.toLocaleDateString('fr-FR')} • {maintenance.duree}{' '}
                            heures
                          </p>
                          <p className="text-sm text-white mb-2">{maintenance.description}</p>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>Coût: {fmtNum(maintenance.cout)}</span>
                            <span>Asset ID: {maintenance.assetId}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Vue rapports */}
          {selectedView === 'reports' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 sm:p-6 rounded-[1.8rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
                <h3 className="text-[11px] font-black mb-4 flex items-center gap-2 text-blue-300/65 uppercase tracking-[0.08em]">
                  <FileText size={18} className="text-blue-500" /> Rapports Patrimoniaux
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => navigate('/rapports/inventaire')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Package size={20} className="text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Rapport d'Inventaire</p>
                        <p className="text-xs text-slate-400">{assetMetrics.totalAssets} actifs</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/rapports/maintenance')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Wrench size={20} className="text-emerald-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Rapport de Maintenance</p>
                        <p className="text-xs text-slate-400">
                          {maintenanceData.length} interventions
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/rapports/valeur')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign size={20} className="text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Rapport de Valeur</p>
                        <p className="text-xs text-slate-400">VNC et amortissements</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => navigate('/rapports/performance')}
                    className="p-4 bg-white/[0.02] rounded-lg border border-white/5 hover:bg-white/[0.05] transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <BarChart3 size={20} className="text-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Rapport de Performance</p>
                        <p className="text-xs text-slate-400">KPIs et indicateurs</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ContentArea>
    </PageContainer>
  );
}
