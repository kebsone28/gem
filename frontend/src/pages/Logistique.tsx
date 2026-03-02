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

const TABS = [
    { id: 'stock', label: 'Stock & Matériel', icon: Package },
    { id: 'deliveries', label: 'Livraisons', icon: Truck },
    { id: 'agents', label: 'Équipes & Agents', icon: Users },
    { id: 'workshop', label: 'Atelier', icon: Wrench },
    { id: 'grappes', label: 'Grappes & Affectations', icon: MapIcon },
];

export default function Logistique() {
    const [activeTab, setActiveTab] = useState('stock');
    const { isLoading } = useLogistique();

    return (
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
            <header className="bg-slate-900 border-b border-slate-800 p-6 shrink-0">
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight">Gestion Logistique</h2>
                        <p className="text-slate-500 mt-1">Orchestration du matériel, des équipes et des zones</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button title="Synchroniser" className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all">
                            <RefreshCcw size={20} />
                        </button>
                        <div className="h-8 w-px bg-slate-800 mx-2" />
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Recherche globale..."
                                className="bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64"
                            />
                        </div>
                    </div>
                </div>

                <nav className="flex flex-wrap items-center justify-center gap-1 mt-8 bg-slate-950/50 p-1.5 rounded-2xl border border-slate-800 w-fit mx-auto">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                                    }`}
                            >
                                <Icon size={18} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </header>

            <main className="flex-1 overflow-auto p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950">
                <div className="max-w-7xl mx-auto h-full">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-slate-500 font-medium animate-pulse">Chargement des données logistiques...</p>
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
