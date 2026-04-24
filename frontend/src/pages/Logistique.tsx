/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from 'react';
import { Package, Truck, Users, Wrench, Map as MapIcon, RefreshCcw, Search } from 'lucide-react';
import StockTab from '../components/logistique/StockTab';
import DeliveriesTab from '../components/logistique/DeliveriesTab';
import AgentsTab from '../components/logistique/AgentsTab';
import WorkshopTab from '../components/logistique/WorkshopTab';
import GrappesTab from '../components/logistique/GrappesTab';
import TeamLedgerTab from '../components/logistique/TeamLedgerTab';
import { useLogistique } from '../hooks/useLogistique';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

// Import centralized design system
import { PageContainer, PageHeader, ContentArea, ActionBar, ModulePageShell } from '../components';
import { DASHBOARD_SECTION_SURFACE, MODULE_ACCENTS } from '../components/dashboards/DashboardComponents';

type LogistiqueTabId = 'stock' | 'deliveries' | 'agents' | 'ledger' | 'workshop' | 'grappes';

const TABS: Array<{
  id: LogistiqueTabId;
  label: string;
  mobileLabel: string;
  icon: typeof Package;
}> = [
  { id: 'stock', label: 'Stock & Matériel', mobileLabel: 'Stock', icon: Package },
  { id: 'deliveries', label: 'Livraisons', mobileLabel: 'Livraisons', icon: Truck },
  { id: 'agents', label: 'Suivi des Agents', mobileLabel: 'Agents', icon: Users },
  { id: 'ledger', label: 'Ordres de Mission', mobileLabel: 'Ordres', icon: Package },
  { id: 'workshop', label: 'Atelier', mobileLabel: 'Atelier', icon: Wrench },
  { id: 'grappes', label: 'Déploiement Terrain', mobileLabel: 'Terrain', icon: MapIcon },
];

export default function Logistique() {
  const [activeTab, setActiveTab] = useState<LogistiqueTabId>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isLoading } = useLogistique();
  const { isDarkMode } = useTheme();
  const logistiqueAccent = MODULE_ACCENTS.logistique;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate refresh
      await new Promise((resolve) => setTimeout(resolve, 1200));
      toast.success('Données synchronisées ✓');
    } catch (error) {
      toast.error('Erreur lors de la synchronisation');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Opérations & Logistique"
        subtitle="Suivi en temps réel du matériel, des performances agents et de l'avancement du déploiement"
        icon={Package}
        accent="logistique"
        actions={
          <ActionBar className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${logistiqueAccent.badge}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse opacity-80" />
              <span className="text-xs font-black uppercase tracking-widest leading-none">
                Live Data
              </span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`rounded-xl p-3 transition-all disabled:opacity-50 ${logistiqueAccent.badge} hover:bg-white/[0.08]`}
              aria-label="Synchroniser les données"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </ActionBar>
        }
      />

      <ModulePageShell accent="logistique" className="space-y-4 sm:space-y-6">
      {/* Barre de recherche */}
      <div>
        <div
          className={`group flex w-full max-w-none items-center rounded-2xl border p-0.5 transition-all duration-500 sm:max-w-sm ${isDarkMode ? `${DASHBOARD_SECTION_SURFACE} ${logistiqueAccent.surface}` : 'bg-slate-100/80 border-slate-200'} `}
        >
          <div className="flex-1 flex items-center gap-3 px-4">
            <Search
              className={`transition-colors duration-300 ${isDarkMode ? 'text-slate-600 group-focus-within:text-amber-300' : 'text-slate-400 group-focus-within:text-amber-500'}`}
              size={16}
            />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-transparent border-none py-3 text-sm font-bold outline-none transition-colors ${isDarkMode ? 'text-white placeholder:text-slate-700' : 'text-slate-700 placeholder:text-slate-400'}`}
            />
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div>
        <nav
          className={`overflow-hidden rounded-2xl border transition-colors ${isDarkMode ? `${DASHBOARD_SECTION_SURFACE} ${logistiqueAccent.surface}` : 'border-slate-200 bg-slate-100/80'}`}
        >
          <div className="flex overflow-x-auto gap-1 p-1 scrollbar-hide snap-x snap-mandatory">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={isActive}
                    className={`snap-start shrink-0 flex min-w-fit items-center gap-2 px-4 py-3 whitespace-nowrap font-semibold text-sm transition-all border-b-2 sm:flex-1 sm:justify-center sm:px-5 sm:py-4 ${
                    isActive
                      ? `border-amber-500 ${isDarkMode ? 'text-amber-300 bg-amber-500/10' : 'text-amber-700 bg-amber-50'}`
                      : `border-transparent ${isDarkMode ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'}`
                  }`}
                >
                  <Icon size={18} />
                  <span className="sm:hidden">{tab.mobileLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
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
                <p className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
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
              {activeTab === 'workshop' && <WorkshopTab />}
              {activeTab === 'grappes' && <GrappesTab />}
            </>
          )}
        </div>
      </ContentArea>
      </ModulePageShell>
    </PageContainer>
  );
}
