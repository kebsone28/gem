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

const TABS = [
    { id: 'stock', label: 'Stock & Matériel', icon: Package },
    { id: 'deliveries', label: 'Livraisons', icon: Truck },
    { id: 'agents', label: 'Équipes & Agents', icon: Users },
    { id: 'workshop', label: 'Atelier', icon: Wrench },
    { id: 'grappes', label: 'Grappes', icon: MapIcon },
];

export default function Logistique() {
    const [activeTab, setActiveTab] = useState('stock');
    const { isLoading } = useLogistique();
    const { isDarkMode } = useTheme();

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <header className={`border-b p-6 shrink-0 ${isDarkMode ? 'bg-dark-bg border-dark-border' : 'bg-surface-elevated border-border-subtle'}`}>
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <div>
                        <h2 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-dark-text' : 'text-text'}`}>Gestion Logistique</h2>
                        <p className={`text-sm mt-1 ${isDarkMode ? 'text-dark-text-muted' : 'text-text-muted'}`}>Orchestration du matériel, des équipes et des zones</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button title="Synchroniser" className={`p-2.5 rounded-[var(--radius-md)] transition-all border ${isDarkMode ? 'bg-dark-surface border-dark-border text-dark-text-muted hover:text-dark-text' : 'bg-surface border-border text-text-muted hover:text-text'}`}>
                            <RefreshCcw size={18} />
                        </button>
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <input
                                type="text"
                                placeholder="Recherche..."
                                className={`input-field pl-10 w-56 text-sm`}
                            />
                        </div>
                    </div>
                </div>

                <nav className="tab-nav mt-6 w-fit mx-auto">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`tab-item ${isActive ? 'active' : ''}`}
                            >
                                <Icon size={16} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </header>

            <main className={`flex-1 overflow-auto p-6 md:p-8 ${isDarkMode ? 'bg-dark-bg' : 'bg-surface'}`}>
                <div className="max-w-7xl mx-auto h-full">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <p className={`text-sm font-medium animate-pulse ${isDarkMode ? 'text-dark-text-muted' : 'text-text-muted'}`}>Chargement...</p>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'stock' && <StockTab />}
                            {activeTab === 'deliveries' && <DeliveriesTab />}
                            {activeTab === 'agents' && <AgentsTab />}
                            {activeTab === 'workshop' && <WorkshopTab />}
                            {activeTab === 'grappes' && <GrappesTab />}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
