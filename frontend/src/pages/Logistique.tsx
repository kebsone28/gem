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
import { PageContainer, PageHeader, ContentArea, ActionBar } from '../components';

const TABS = [
  { id: 'stock', label: 'Stock & Matériel', icon: Package },
  { id: 'deliveries', label: 'Livraisons', icon: Truck },
  { id: 'agents', label: 'Suivi des Agents', icon: Users },
  { id: 'ledger', label: 'Ordres de Mission', icon: Package },
  { id: 'workshop', label: 'Atelier', icon: Wrench },
  { id: 'grappes', label: 'Déploiement Terrain', icon: MapIcon },
];

export default function Logistique() {
  const [activeTab, setActiveTab] = useState('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isLoading } = useLogistique();
  const { isDarkMode } = useTheme();

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
        actions={
          <ActionBar>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 border border-blue-600 dark:border-blue-600">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-black text-blue-900 dark:text-blue-100 uppercase tracking-widest leading-none">
                Live Data
              </span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-3 rounded-xl transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50"
              aria-label="Synchroniser les données"
            >
              <RefreshCcw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </ActionBar>
        }
      />

      {/* Barre de recherche */}
      <div className="px-6 mb-4">
        <div
          className={`group w-full max-w-sm flex items-center p-0.5 rounded-2xl border transition-all duration-500 ${isDarkMode ? 'bg-slate-950/40 border-slate-800 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 focus-within:border-blue-500/80 focus-within:shadow-xl focus-within:shadow-blue-500/10' : 'bg-slate-100/80 border-slate-200 hover:border-blue-400/50 focus-within:border-blue-500/80 focus-within:shadow-xl focus-within:bg-white'}`}
        >
          <div className="flex-1 flex items-center gap-3 px-4">
            <Search
              className={`transition-colors duration-300 ${isDarkMode ? 'text-slate-600 group-focus-within:text-blue-400' : 'text-slate-400 group-focus-within:text-blue-500'}`}
              size={16}
            />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-transparent border-none outline-none text-sm font-bold py-3 transition-colors ${isDarkMode ? 'text-white placeholder:text-slate-700' : 'text-slate-700 placeholder:text-slate-400'}`}
            />
          </div>
        </div>
      </div>

      {/* Navigation par onglets */}
      <div className="px-6 mb-6">
        <nav
          className={`border rounded-2xl overflow-hidden transition-colors ${isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-100/80'}`}
        >
          <div className="flex overflow-x-auto gap-1 scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-5 py-4 whitespace-nowrap font-semibold text-sm transition-all border-b-2 flex-1 justify-center ${
                    isActive
                      ? `border-blue-500 ${isDarkMode ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-50'}`
                      : `border-transparent ${isDarkMode ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'}`
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
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
              {activeTab === 'deliveries' && <DeliveriesTab />}
              {activeTab === 'agents' && <AgentsTab />}
              {activeTab === 'ledger' && <TeamLedgerTab />}
              {activeTab === 'workshop' && <WorkshopTab />}
              {activeTab === 'grappes' && <GrappesTab />}
            </>
          )}
        </div>
      </ContentArea>
    </PageContainer>
  );
}
