import { useState } from 'react';
import {
    Package,
    Truck,
    Users,
    Wrench,
    Map as MapIcon,
    RefreshCcw,
    Search
} from 'lucide-react';
import StockTab from '../components/logistique/StockTab';
import DeliveriesTab from '../components/logistique/DeliveriesTab';
import AgentsTab from '../components/logistique/AgentsTab';
import WorkshopTab from '../components/logistique/WorkshopTab';
import GrappesTab from '../components/logistique/GrappesTab';
import { useLogistique } from '../hooks/useLogistique';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const TABS = [
    { id: 'stock', label: 'Stock & Matériel', icon: Package },
    { id: 'deliveries', label: 'Livraisons', icon: Truck },
    { id: 'agents', label: 'Suivi des Agents', icon: Users },
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
            await new Promise(resolve => setTimeout(resolve, 1200));
            toast.success('Données synchronisées ✓');
        } catch (error) {
            toast.error('Erreur lors de la synchronisation');
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className={`flex flex-col h-full overflow-hidden transition-colors ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
            {/* Header Principal */}
            <header className={`border-b shrink-0 transition-colors ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} backdrop-blur-sm`}>
                <div className="p-6 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Titre */}
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h1 className={`text-4xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    Opérations & Logistique
                                </h1>
                                <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Suivi en temps réel du matériel, des performances agents et de l'avancement du déploiement
                                </p>
                            </div>
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className={`p-3 rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'} disabled:opacity-50 ${isRefreshing ? 'animate-spin' : ''}`}
                                title="Synchroniser les données"
                            >
                                <RefreshCcw size={20} />
                            </button>
                        </div>

                        {/* Barre de recherche (visible sur md+) */}
                        <div className="hidden md:flex">
                            <div className={`flex-1 max-w-sm relative`}>
                                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                <input
                                    type="text"
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`w-full pl-12 pr-4 py-3 rounded-xl border font-medium transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-primary focus:bg-slate-750' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-slate-50'} focus:outline-none focus:ring-2 focus:ring-primary/20`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation par onglets */}
                <nav className={`border-t px-6 md:px-8 ${isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'}`}>
                    <div className="max-w-7xl mx-auto flex overflow-x-auto gap-1 -mb-px scrollbar-hide">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2.5 px-5 py-4 whitespace-nowrap font-semibold text-sm transition-all border-b-2 ${
                                        isActive
                                            ? `border-primary ${isDarkMode ? 'text-primary' : 'text-primary'}`
                                            : `border-transparent ${isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-600 hover:text-slate-900'}`
                                    }`}
                                >
                                    <Icon size={18} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </header>

            {/* Contenu principal */}
            <main className={`flex-1 overflow-auto transition-colors ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <div className="p-6 md:p-8 h-full">
                    <div className="max-w-7xl mx-auto h-full">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-6">
                                <div className={`w-12 h-12 border-4 rounded-full animate-spin ${isDarkMode ? 'border-slate-700 border-t-primary' : 'border-slate-200 border-t-primary'}`} />
                                <div className="text-center">
                                    <p className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Chargement des données</p>
                                    <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Veuillez patienter...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'stock' && <StockTab searchQuery={searchQuery} />}
                                {activeTab === 'deliveries' && <DeliveriesTab />}
                                {activeTab === 'agents' && <AgentsTab />}
                                {activeTab === 'workshop' && <WorkshopTab />}
                                {activeTab === 'grappes' && <GrappesTab />}
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
