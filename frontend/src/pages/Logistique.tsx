/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from 'react';
import { Package, Truck, Users, Wrench, Map as MapIcon, RefreshCcw, Search } from 'lucide-react';
import StockTab from '../components/logistique/StockTab';
import DeliveriesTab from '../components/logistique/DeliveriesTab';
import AgentsTab from '../components/logistique/AgentsTab';
import GrappesTab from '../components/logistique/GrappesTab';
import TeamLedgerTab from '../components/logistique/TeamLedgerTab';
import { useLogistique } from '../hooks/useLogistique';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { useLabels } from '../contexts/LabelsContext';
import toast from 'react-hot-toast';

// Import centralized design system
import { PageContainer, PageHeader, ContentArea, ActionBar, ModulePageShell } from '../components';
import {
  DASHBOARD_SECTION_SURFACE,
  MODULE_ACCENTS,
} from '../components/dashboards/DashboardComponents';

type LogistiqueTabId = 'stock' | 'deliveries' | 'agents' | 'ledger' | 'grappes';


export default function Logistique() {
  const { peut } = usePermissions();
  const { getLabel } = useLabels();

  const TABS: Array<{
    id: LogistiqueTabId;
    label: string;
    mobileLabel: string;
    icon: typeof Package;
    permission: string;
  }> = [
    { id: 'stock', label: 'Stock & Matériel', mobileLabel: 'Stock', icon: Package, permission: 'logistique.stock' },
    { id: 'deliveries', label: 'Livraisons', mobileLabel: 'Livraisons', icon: Truck, permission: 'logistique.deliveries' },
    { id: 'agents', label: 'Suivi des Agents', mobileLabel: 'Agents', icon: Users, permission: 'logistique.agents' },
    { id: 'ledger', label: `Ordres de ${getLabel('mission', 2)}`, mobileLabel: 'Ordres', icon: Package, permission: 'logistique.om' },
    { id: 'grappes', label: 'Déploiement Terrain', mobileLabel: 'Terrain', icon: MapIcon, permission: 'logistique.deployment' },
  ];

  const allowedTabs = TABS.filter(t => peut(t.permission));
  
  const [activeTab, setActiveTab] = useState<LogistiqueTabId>(allowedTabs[0]?.id || 'stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isLoading, refreshTeams } = useLogistique();
  const { isDarkMode } = useTheme();
  const logistiqueAccent = MODULE_ACCENTS.logistique;

  const SEARCHABLE_TABS: LogistiqueTabId[] = ['stock', 'deliveries', 'agents', 'ledger'];

  const handleTabChange = (tabId: LogistiqueTabId) => {
    setActiveTab(tabId);
    setSearchQuery('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTeams();
      toast.success('Données synchronisées ✓');
    } catch (e) {
      toast.error('Erreur lors du rechargement');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Logistique"
        subtitle="Suivi temps réel matériel & agents"
        icon={Package}
        accent="logistique"
        actions={
          <ActionBar className="flex items-center gap-2">
            <div className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${logistiqueAccent.badge}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse opacity-80" />
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">Live</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`rounded-2xl p-2.5 sm:p-3 transition-all active:scale-90 disabled:opacity-50 ${logistiqueAccent.badge} hover:bg-white/10`}
              aria-label="Synchroniser"
            >
              <RefreshCcw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </ActionBar>
        }
      />

      <ModulePageShell accent="logistique" className="space-y-4 sm:space-y-6">
        {/* Barre de recherche — Ultra-compacte sur mobile */}
        {SEARCHABLE_TABS.includes(activeTab) && (
          <div className="px-2 sm:px-0">
            <div
              className={`group flex w-full items-center rounded-[1.2rem] sm:rounded-2xl border p-0.5 transition-all duration-500 sm:max-w-sm ${isDarkMode ? `${DASHBOARD_SECTION_SURFACE} ${logistiqueAccent.surface}` : 'bg-slate-100/80 border-slate-200'} `}
            >
              <div className="flex-1 flex items-center gap-3 px-4">
                <Search
                  className={`transition-colors duration-300 ${isDarkMode ? 'text-slate-600 group-focus-within:text-amber-400' : 'text-slate-400 group-focus-within:text-amber-500'}`}
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Recherche rapide..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full bg-transparent border-none py-2.5 sm:py-3 text-sm font-bold outline-none transition-colors ${isDarkMode ? 'text-white placeholder:text-slate-700' : 'text-slate-700 placeholder:text-slate-400'}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigation par onglets — Scrollable & Snap */}
        <div className="px-2 sm:px-0">
          <nav
            className={`overflow-hidden rounded-[1.5rem] border transition-colors ${isDarkMode ? `${DASHBOARD_SECTION_SURFACE} ${logistiqueAccent.surface}` : 'border-slate-200 bg-slate-100/80'}`}
          >
            <div className="flex overflow-x-auto gap-0.5 p-1 scrollbar-hide snap-x snap-mandatory">
              {allowedTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    aria-pressed={isActive}
                    className={`snap-start shrink-0 flex min-w-fit items-center gap-2.5 px-5 py-3.5 whitespace-nowrap font-black text-[10px] uppercase tracking-widest transition-all sm:flex-1 sm:justify-center sm:px-5 sm:py-4 ${
                      isActive
                        ? `text-amber-400 bg-white/5 shadow-inner`
                        : `text-slate-500 hover:text-slate-300 hover:bg-white/5`
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-amber-400' : 'text-slate-600'} />
                    <span className="sm:hidden">{tab.mobileLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    {isActive && (
                      <motion.div 
                        layoutId="activeTabLog"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        <ContentArea className="p-0">
          <div className="h-full">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div
                  className={`w-12 h-12 border-4 rounded-full animate-spin ${isDarkMode ? 'border-slate-700 border-t-blue-500' : 'border-slate-200 border-t-blue-500'}`}
                />
                <div className="text-center">
                  <p
                    className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                  >
                    Chargement des données
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    Veuillez patienter...
                  </p>
                </div>
              </div>
            ) : (
              <>
                {activeTab === 'stock' && <StockTab searchQuery={searchQuery} />}
                {activeTab === 'deliveries' && <DeliveriesTab searchQuery={searchQuery} />}
                {activeTab === 'agents' && <AgentsTab searchQuery={searchQuery} />}
                {activeTab === 'ledger' && <TeamLedgerTab searchQuery={searchQuery} />}
                {activeTab === 'grappes' && <GrappesTab />}
              </>
            )}
          </div>
        </ContentArea>
      </ModulePageShell>
    </PageContainer>
  );
}
