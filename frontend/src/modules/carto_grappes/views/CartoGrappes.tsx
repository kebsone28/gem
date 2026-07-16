import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartoGrappes } from '../hooks/useCartoGrappes';
import { REGIONS } from '../constants';
import type { TabKey } from '../types';
import { ToastProvider } from '../utils/Toast';
import MapView from './MapView';
import BordereauView from './BordereauView';
import DashboardView from './DashboardView';
import FichesView from './FichesView';
import PlanningView from './PlanningView';
import AdminView from './AdminView';
import DossiersView from './DossiersView';
import HistoryView from './HistoryView';
import SyncView from './SyncView';

import AlertsView from './AlertsView';
import WorkflowView from './WorkflowView';
import SettingsView from './SettingsView';
import ComputedAlertsView from './ComputedAlertsView';
import HelpView from './HelpView';
import ContratView from './ContratView';
import StatsView from './StatsView';
import PrestatairesDB from './PrestatairesDB';

const TABS: { key: TabKey; label: string; icon: string; group: number }[] = [
  { key: 'map', label: 'Carte', icon: '\u{1F5FA}', group: 1 },
  { key: 'gps', label: 'Carte GPS', icon: '\u{1F4E1}', group: 1 },

  { key: 'bordereau', label: 'Bordereau', icon: '\u{1F4CB}', group: 1 },
  { key: 'dashboard', label: 'Tableau de bord', icon: '\u{1F4CA}', group: 1 },
  { key: 'fiches', label: 'Fiches de suivi', icon: '\u{1F4DD}', group: 2 },
  { key: 'admin', label: 'Administration', icon: '\u2699', group: 2 },
  { key: 'prestataires' as TabKey, label: 'Prestataires', icon: '\u{1F3E2}', group: 2 },
  { key: 'dossiers', label: 'Dossiers', icon: '\u{1F4C1}', group: 2 },
  { key: 'contrat', label: 'Contrats', icon: '\u{1F4C4}', group: 2 },
  { key: 'stats' as TabKey, label: 'Evolution', icon: '\u{1F4C8}', group: 3 },
  { key: 'planning', label: 'Planning', icon: '\u{1F3D7}', group: 3 },
  { key: 'history', label: 'Historique', icon: '\u{1F4DD}', group: 3 },
  { key: 'alerts', label: 'Alertes', icon: '\u{1F514}', group: 3 },
  { key: 'alerts-computed', label: 'Alertes calc.', icon: '\u{1F4CA}', group: 3 },
  { key: 'workflow', label: 'Validation', icon: '\u2705', group: 3 },
  { key: 'sync', label: 'Sync', icon: '\u{1F4E1}', group: 3 },
  { key: 'settings', label: 'Parametres', icon: '\u2699', group: 3 },
  { key: 'help', label: 'Aide', icon: '\u2753', group: 3 },
];

const CartoGrappes: React.FC = () => {
  const navigate = useNavigate();
  const {
    loading,
    activeTab,
    setActiveTab,
    villages,
    menages,
    gps,
    entries,
    getEntry,
    updateEntry,
    updateConforme,
    updateObs,
    entrepreneurConfig,
    updateEntrepreneurConfig,
    syncEntrepreneursToAPI,
    lotModes,
    updateLotMode,
    selectedRegion,
    setSelectedRegion,
    selectedGrappe,
    setSelectedGrappe,
    selectedLot,
    setSelectedLot,
    searchQuery,
    setSearchQuery,
    regionSummaries,
    globalSummary,
    filteredMenages,
    getEntrepreneur,
    history,
    loadHistory,
    prestataires,
    updatePrestataires,
    importPrestatairesExcel,
    createPrestataire,
    updatePrestataire,
    deletePrestataire,
    importGlobalBackup,
    importExcelData,
    resetAllData,
    dashboardStats,
    refreshDashboardStats,
    initializeServerData,
    serverConfig,
  } = useCartoGrappes();

  const regionGrappes = useMemo(() => regionSummaries.flatMap((r) => r.grappes), [regionSummaries]);

  const menageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of menages) {
      counts[m.region] = (counts[m.region] || 0) + 1;
    }
    return counts;
  }, [menages]);

  const totalConforme = useMemo(
    () => regionSummaries.reduce((s, r) => s + r.grappes.reduce((gs, g) => gs + g.conforme, 0), 0),
    [regionSummaries]
  );

  const totalGrappes = useMemo(
    () => regionSummaries.reduce((s, r) => s + r.grappes.length, 0),
    [regionSummaries]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-300 font-medium">Chargement du planning...</span>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: '\u{1F4CD}',
      title: 'Position GPS en direct',
      desc: 'Localisation de chaque technicien en temps reel sur la carte vectorielle MapLibre.',
    },
    {
      icon: '\u{1F9ED}',
      title: 'Itineraires et routing',
      desc: 'Calcul de trajets vers les villages cibles avec distance et duree estimee.',
    },
    {
      icon: '\u{1F512}',
      title: 'Geofencing',
      desc: "Delimitation de zones d'intervention avec alertes automatiques de sortie de zone.",
    },
    {
      icon: '\u{1F4F8}',
      title: 'Photos geolocalisees',
      desc: "Capture de photos terrain horodatees et liees aux points d'intervention.",
    },
    {
      icon: '\u{1F504}',
      title: 'Sync et mode hors-ligne',
      desc: 'Fonctionnement complet sans internet, synchronisation automatique a la reconnexion.',
    },
    {
      icon: '\u{1F4CA}',
      title: 'Donnees et statuts',
      desc: "Mise a jour des statuts d'avancement par menage directement depuis le terrain.",
    },
  ];

  return (
    <ToastProvider>
      <div className="flex flex-col min-h-[calc(100vh-64px)] bg-slate-50">
        <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-3 shadow-lg">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">
              Planning Global - PROQUELEC
            </h1>
            <p className="text-[11px] text-blue-200/80 mt-0.5 truncate">
              PROQUELEC - Kaffrine et Tambacounda - {globalSummary.total} menages repartis en{' '}
              {totalGrappes} grappes
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="region-filter" className="sr-only">
              Filtrer par region
            </label>
            <select
              id="region-filter"
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedGrappe(null);
              }}
              className="px-3 py-1.5 text-[11px] font-semibold bg-white/10 border border-white/20 rounded-lg text-white backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="__ALL__" className="text-slate-800" style={{ color: '#1e293b' }}>
                Toutes les regions
              </option>
              {REGIONS.map((r) => (
                <option key={r} value={r} className="text-slate-800" style={{ color: '#1e293b' }}>
                  {r}
                </option>
              ))}
            </select>
            <label htmlFor="search-input" className="sr-only">
              Rechercher un menage
            </label>
            <input
              id="search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un menage..."
              className="px-3 py-1.5 text-[11px] bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 backdrop-blur-sm w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </header>

        <nav
          className="bg-white border-b border-slate-200 px-2 sm:px-4 flex gap-0.5 overflow-x-auto shadow-sm"
          role="tablist"
          aria-label="Onglets principaux"
        >
          {TABS.map((tab, i) => {
            const prevGroup = i > 0 ? TABS[i - 1].group : 0;
            return (
              <React.Fragment key={tab.key}>
                {i > 0 && tab.group !== prevGroup && (
                  <div className="w-px bg-slate-200 mx-1 self-stretch" aria-hidden="true" />
                )}
                <button
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-label={tab.label}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1 px-3 py-3 text-[11px] font-semibold border-b-2 transition-all whitespace-nowrap min-h-[44px] min-w-[44px] justify-center ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <main className="flex-1 overflow-auto min-h-0" role="main">
          <div>
            {activeTab === 'map' && (
              <MapView
                villages={villages}
                selectedRegion={selectedRegion}
                selectedGrappe={selectedGrappe}
                regionGrappes={regionGrappes}
                onSelectGrappe={setSelectedGrappe}
                menages={menages}
                getEntry={getEntry}
                entrepreneurConfig={entrepreneurConfig}
                onUpdateConfig={updateEntrepreneurConfig}
                onSyncToAPI={syncEntrepreneursToAPI}
                prestataires={prestataires}
              />
            )}
            {activeTab === 'gps' && (
              <div className="flex flex-col items-center justify-start pt-8 sm:pt-12 px-4 pb-10 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-full">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-xl shadow-blue-500/20 mb-6">
                  <span className="text-4xl">{'\u{1F6F0}'}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2 text-center">
                  Carte GPS Terrain
                </h2>
                <p className="text-sm text-slate-500 mb-8 text-center max-w-lg leading-relaxed">
                  La carte GPS interactive est geree par le module{' '}
                  <strong className="text-blue-600">Terrain</strong>, un outil dedie au suivi
                  terrain en temps reel. Cliquez ci-dessous pour y acceder.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl w-full mb-8">
                  {features.map((f) => (
                    <div
                      key={f.title}
                      className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-300/50 transition-all duration-200"
                    >
                      <span className="text-2xl flex-shrink-0 mt-0.5">{f.icon}</span>
                      <div>
                        <div className="text-sm font-bold text-slate-800 mb-0.5">{f.title}</div>
                        <div className="text-xs text-slate-500 leading-relaxed">{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/operations/map')}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 text-sm sm:text-base flex items-center gap-2.5"
                >
                  <span className="text-lg">{'\u{1F30D}'}</span>
                  Ouvrir la carte Terrain
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </button>

                <div className="mt-6 flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                      />
                    </svg>
                    <span>
                      Pour revenir au Planning, utilisez le bouton{' '}
                      <strong className="text-blue-500">Planning</strong> dans la barre du module
                      Terrain, ou revenez via le menu lateral.
                    </span>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'bordereau' && (
              <BordereauView
                menages={filteredMenages}
                selectedRegion={selectedRegion}
                selectedGrappe={selectedGrappe}
                selectedLot={selectedLot}
                onSelectLot={setSelectedLot}
                getEntry={getEntry}
                updateEntry={updateEntry}
                updateConforme={updateConforme}
                updateObs={updateObs}
                searchQuery={searchQuery}
                getEntrepreneur={getEntrepreneur}
                gps={gps}
              />
            )}
            {activeTab === 'dashboard' && (
              <DashboardView
                menages={filteredMenages}
                entries={entries}
                regionSummaries={regionSummaries}
                globalSummary={{
                  ...globalSummary,
                  conforme: totalConforme,
                  pourcentage: globalSummary.pct,
                }}
              />
            )}
            {activeTab === 'fiches' && <FichesView menages={filteredMenages} />}
            {activeTab === 'planning' && <PlanningView menageCounts={menageCounts} />}
            {activeTab === 'admin' && (
              <AdminView
                entrepreneurConfig={entrepreneurConfig}
                lotModes={lotModes}
                onUpdateConfig={updateEntrepreneurConfig}
                onUpdateLotMode={updateLotMode}
                onSyncToAPI={syncEntrepreneursToAPI}
                getEntrepreneur={getEntrepreneur}
                menages={menages}
                villages={villages}
                gps={gps}
                onVillageOverride={setSelectedGrappe}
                onImportExcel={importExcelData}
                onResetAllData={resetAllData}
                prestataires={prestataires}
                onPrestataireCreate={createPrestataire}
                onPrestataireUpdate={updatePrestataire}
                onPrestataireDelete={deletePrestataire}
                serverDashboardStats={dashboardStats}
                refreshDashboardStats={refreshDashboardStats}
                initializeServerData={initializeServerData}
                serverConfig={serverConfig}
              />
            )}
            {activeTab === 'dossiers' && (
              <DossiersView
                menages={filteredMenages}
                entries={entries}
                getEntry={getEntry}
                selectedLot={selectedLot}
                regionSummaries={regionSummaries}
                globalSummary={globalSummary}
                entrepreneurConfig={entrepreneurConfig}
                lotModes={lotModes}
                getEntrepreneur={getEntrepreneur}
                villages={villages}
                gps={gps}
                onImportGlobalBackup={importGlobalBackup}
              />
            )}
            {activeTab === 'history' && (
              <HistoryView history={history} menages={menages} onRefresh={loadHistory} />
            )}
            {activeTab === 'alerts' && <AlertsView />}
            {activeTab === 'alerts-computed' && (
              <ComputedAlertsView entries={entries} menages={filteredMenages} alertConfig={null} />
            )}
            {activeTab === 'workflow' && <WorkflowView />}
            {activeTab === 'sync' && <SyncView menages={menages} entries={entries} />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'prestataires' && (
              <PrestatairesDB
                prestataires={prestataires}
                onUpdate={updatePrestataires}
                onImportExcel={importPrestatairesExcel}
              />
            )}
            {activeTab === 'contrat' && (
              <ContratView menages={menages} getEntrepreneur={getEntrepreneur} gps={gps} />
            )}
            {activeTab === 'stats' && <StatsView entries={entries} menages={menages} />}
            {activeTab === 'help' && <HelpView role="admin" />}
          </div>
          <footer
            role="contentinfo"
            className="border-t border-slate-200 px-4 py-3 text-[11px] text-slate-400 text-center"
          >
            GED OS - Planning Global - PROQUELEC
          </footer>
        </main>
      </div>
    </ToastProvider>
  );
};

export default React.memo(CartoGrappes);
