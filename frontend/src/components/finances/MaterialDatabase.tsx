import { useState, useRef } from 'react';
import {
    Package,
    Plus,
    Save,
    Database,
    Info,
    DownloadCloud,
    FileSpreadsheet,
    Trash2,
    Search,
    Filter,
    ChevronUp,
    ChevronDown
} from 'lucide-react';
import { useFinances } from '../../hooks/useFinances';
import { useTheme } from '../../contexts/ThemeContext';
import { useProject } from '../../hooks/useProject';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { fmtFCFA } from '../../utils/format';
import logger from '../../utils/logger';

const STANDARD_CATALOG = [
    { name: 'Poteau Béton HTA 12m/800daN', category: 'HTA', stock: 150, unitPrice: 350000 },
    { name: 'Transformateur H61 100kVA 30kV/B2', category: 'HTA', stock: 5, unitPrice: 2400000 },
    { name: 'Câble Almélec 54.6 mm²', category: 'HTA', stock: 12000, unitPrice: 1500 },
    { name: 'IAC Type Aérien 30kV', category: 'HTA', stock: 2, unitPrice: 850000 },
    { name: 'Câble Torsadé Alu 3x70+54.6+16', category: 'RESEAU', stock: 8500, unitPrice: 2200 },
    { name: 'Pince d\'Ancrage PA 1500', category: 'RESEAU', stock: 300, unitPrice: 4500 },
    { name: 'Luminaire LED 60W Senelec', category: 'ECLAIRAGE PUBLIC', stock: 80, unitPrice: 125000 },
    { name: 'Crosse en Acier Galva 2m', category: 'ECLAIRAGE PUBLIC', stock: 85, unitPrice: 35000 },
    { name: 'Coffret de Façade (Branchement)', category: 'NS 01-001', stock: 2350, unitPrice: 18500 },
    { name: 'Compteur Woyofal Monophasé', category: 'NS 01-001', stock: 2350, unitPrice: 45000 },
    { name: 'Disjoncteur de Branchement 5/15A', category: 'NS 01-001', stock: 2350, unitPrice: 12500 }
];

const CATEGORY_COLORS: Record<string, string> = {
    'HTA': 'indigo',
    'BT': 'blue',
    'ECLAIRAGE PUBLIC': 'emerald',
    'RESEAU': 'rose',
    'NS 01-001': 'amber',
    'Autre': 'slate'
};

export default function MaterialDatabase() {
    const {
        inventory,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        stats,
        devis,
        toggleIncludeSupply
    } = useFinances();
    const { project } = useProject();
    const { isDarkMode } = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', category: 'HTA', stock: 0, unitPrice: 0 });
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const filteredInventory = (inventory || [])
        .filter((item: any) => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        })
        .sort((a: any, b: any) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            if (sortOrder === 'asc') return nameA > nameB ? 1 : -1;
            return nameA < nameB ? 1 : -1;
        });

    const toggleSort = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');

    const handleImport = async () => {
        if (!project?.id) return;
        for (const item of STANDARD_CATALOG) {
            await addInventoryItem({ ...item, isActive: true });
        }
    };

    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !project?.id) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                for (const row of data as any[]) {
                    const rowId = row['ID'] || row['id'];
                    const mat = {
                        name: row['Désignation'] || row['Name'] || row['Item'] || 'Article sans nom',
                        category: row['Catégorie'] || row['Category'] || 'BT',
                        stock: Number(row['Stock'] || row['Quantité'] || 0),
                        unitPrice: Number(row['Prix_Unitaire_HT_FCFA'] || row['Prix'] || row['Price'] || 0),
                        unit: row['Unité'] || row['Unit'] || 'U',
                        isActive: row['Actif'] === 'NON' ? false : true
                    };

                    if (rowId) {
                        const existing = inventory.find((i: any) => i.id === rowId);
                        if (existing) {
                            await updateInventoryItem(rowId, mat);
                            continue;
                        }
                    }
                    await addInventoryItem(mat);
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
                alert("Importation et mise à jour terminées avec succès !");
            } catch (error) {
                logger.error("Erreur lors de l'import Excel:", error);
                alert("Erreur lors de la lecture du fichier. Vérifiez le format.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExportExcel = () => {
        if (!inventory || inventory.length === 0) {
            alert("Aucun matériel à exporter.");
            return;
        }

        const exportData = inventory.map((item: any) => ({
            'ID': item.id,
            'Désignation': item.name,
            'Catégorie': item.category,
            'Stock': item.stock,
            'Unité': item.unit || 'U',
            'Prix_Unitaire_HT_FCFA': item.unitPrice,
            'Actif': item.isActive !== false ? 'OUI' : 'NON'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventaire");

        const date = new Date().toISOString().split('T')[0];
        const filename = `Export_Materiels_${project?.name?.replace(/\s+/g, '_') || 'Projet'}_${date}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    const handleAdd = async () => {
        if (!newItem.name) return;
        await addInventoryItem({ ...newItem, isActive: true });
        setNewItem({ name: '', category: 'HTA', stock: 0, unitPrice: 0 });
        setIsAdding(false);
    };

    const includeSupply = !!devis.includeSupplyMode;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Supply Toggle Banner */}
            <div className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col md:flex-row items-center justify-between gap-6 ${includeSupply
                ? 'bg-indigo-600/10 border-indigo-500/30'
                : 'bg-slate-900/50 border-slate-800'}`}>
                <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-2xl ${includeSupply ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                        <Database size={32} />
                    </div>
                    <div>
                        <h3 className={`text-xl font-black uppercase tracking-tighter italic ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            Suivi de l'Approvisionnement Matériel
                        </h3>
                        <p className="text-xs font-medium text-slate-500 max-w-md">
                            Activez cette option pour inclure le coût d'achat des matériaux dans le bilan financier global.
                            Sinon, seuls les coûts de main d'œuvre et logistique seront comptabilisés.
                        </p>
                    </div>
                </div>

                <button
                    onClick={toggleIncludeSupply}
                    className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 ${includeSupply
                        ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
                >
                    {includeSupply ? 'DÉSACTIVER CALCUL ACHAT' : 'ACTIVER CALCUL ACHAT'}
                </button>
            </div>

            {/* Inventory Table */}
            <div className={`border rounded-[2.5rem] overflow-hidden shadow-2xl transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="p-8 border-b border-slate-800/10 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                            <Package size={24} />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold tracking-tight italic">Catalogue & Tarification</h4>
                            <p className="text-xs text-slate-500 font-medium">Gérez vos références et prix unitaires HT</p>
                        </div>
                    </div>

                    <div className="flex-1 flex items-center gap-4 px-2">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={14} />
                            <input
                                placeholder="Rechercher par nom..."
                                className={`w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-xs focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all placeholder:text-slate-400 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="relative group">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={14} />
                            <select
                                aria-label="Filtrer par catégorie"
                                className={`bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-8 text-xs font-bold uppercase tracking-wider outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 cursor-pointer appearance-none min-w-[180px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                            >
                                <option value="ALL">Toutes Catégories</option>
                                <option value="HTA">HTA (Haute Tension)</option>
                                <option value="BT">BT (Basse Tension)</option>
                                <option value="ECLAIRAGE PUBLIC">Éclairage Public</option>
                                <option value="RESEAU">Réseau / GC</option>
                                <option value="NS 01-001">NS 01-001 (Senelec)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            title="Choisir un fichier Excel ou CSV"
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleExcelImport}
                        />

                        {inventory.length === 0 && (
                            <button
                                onClick={handleImport}
                                aria-label="Charger le catalogue standard"
                                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all border border-slate-200 dark:border-slate-700"
                            >
                                <DownloadCloud size={14} /> CATALOGUE TYPE
                            </button>
                        )}

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="Importer Excel"
                            className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-primary hover:border-primary transition-all shadow-sm dark:shadow-none"
                        >
                            <FileSpreadsheet size={18} />
                        </button>

                        <button
                            onClick={handleExportExcel}
                            aria-label="Exporter Excel"
                            className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-primary hover:border-primary transition-all shadow-sm dark:shadow-none"
                        >
                            <DownloadCloud size={18} />
                        </button>

                        <button
                            onClick={() => setIsAdding(true)}
                            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
                        >
                            <Plus size={16} /> NOUVEAU
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className={`border-b ${isDarkMode ? 'bg-slate-950/30 border-slate-800/50' : 'bg-slate-50 border-slate-100'}`}>
                                <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-400">Sél.</th>
                                <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-400">
                                    <button
                                        onClick={toggleSort}
                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                    >
                                        Désignation Matériel
                                        {sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                </th>
                                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-slate-400">Domaine</th>
                                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Qte / Stock</th>
                                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">P.U (HT)</th>
                                <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Valorisation</th>
                                <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-slate-400 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/20">
                            <AnimatePresence mode='popLayout'>
                                {isAdding && (
                                    <motion.tr
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-indigo-600/5"
                                    >
                                        <td className="px-8 py-4"></td>
                                        <td className="px-8 py-4">
                                            <input
                                                aria-label='Nom du matériel'
                                                placeholder="ex: Coffret Senelec"
                                                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs w-full focus:border-indigo-500 outline-none"
                                                value={newItem.name}
                                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                title='Catégorie'
                                                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs w-full focus:border-indigo-500 outline-none uppercase font-black tracking-widest text-xs"
                                                value={newItem.category}
                                                onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                            >
                                                <option>HTA</option>
                                                <option>BT</option>
                                                <option>ECLAIRAGE PUBLIC</option>
                                                <option>RESEAU</option>
                                                <option>NS 01-001</option>
                                                <option>Autre</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <input
                                                title='Stock'
                                                type="number"
                                                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs w-20 text-right focus:border-indigo-500 outline-none"
                                                value={newItem.stock}
                                                onChange={e => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <input
                                                title='Prix unitaire'
                                                type="number"
                                                className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs w-28 text-right focus:border-indigo-500 outline-none"
                                                value={newItem.unitPrice}
                                                onChange={e => setNewItem({ ...newItem, unitPrice: parseInt(e.target.value) || 0 })}
                                            />
                                        </td>
                                        <td className="px-8 py-4 text-right"></td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                aria-label="Enregistrer le matériel"
                                                onClick={handleAdd}
                                                className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-500 transition-colors"
                                            >
                                                <Save size={14} />
                                            </button>
                                        </td>
                                    </motion.tr>
                                )}

                                {filteredInventory.map((item: any) => {
                                    const categoryColor = CATEGORY_COLORS[item.category] || 'slate';
                                    return (
                                        <motion.tr
                                            layout
                                            key={item.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className={`group transition-all ${isDarkMode ? 'hover:bg-indigo-500/5' : 'hover:bg-indigo-50/50'} ${item.isActive === false ? 'opacity-40 grayscale' : ''}`}
                                        >
                                            <td className="px-8 py-5">
                                                <input
                                                    type="checkbox"
                                                    checked={item.isActive !== false}
                                                    aria-label="Inclure dans le calcul"
                                                    onChange={() => updateInventoryItem(item.id, { isActive: item.isActive === false })}
                                                    className="w-4 h-4 rounded-md border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500/50 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-8 py-5">
                                                <input
                                                    title='Nom du matériel'
                                                    className={`bg-transparent border-none text-xs font-bold transition-colors focus:bg-slate-800/50 rounded p-1 outline-none w-full ${isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}
                                                    value={item.name}
                                                    onChange={(e) => updateInventoryItem(item.id, { name: e.target.value })}
                                                />
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="relative">
                                                    <select
                                                        title='Catégorie'
                                                        className={`bg-transparent border-none text-xs font-black uppercase tracking-widest focus:bg-slate-800/50 rounded p-1 outline-none appearance-none pr-4 cursor-pointer
                                                            ${categoryColor === 'indigo' ? 'text-indigo-400' :
                                                                categoryColor === 'blue' ? 'text-blue-400' :
                                                                    categoryColor === 'emerald' ? 'text-emerald-400' :
                                                                        categoryColor === 'rose' ? 'text-rose-400' :
                                                                            categoryColor === 'amber' ? 'text-amber-400' :
                                                                                'text-slate-400'}`}
                                                        value={item.category}
                                                        onChange={(e) => updateInventoryItem(item.id, { category: e.target.value })}
                                                    >
                                                        <option value="HTA">HTA</option>
                                                        <option value="BT">BT</option>
                                                        <option value="ECLAIRAGE PUBLIC">Eclairage Public</option>
                                                        <option value="RESEAU">Réseau</option>
                                                        <option value="NS 01-001">NS 01-001</option>
                                                        <option value="Autre">Autre</option>
                                                    </select>
                                                    <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-shadow group-hover:shadow-[0_0_8px] 
                                                        ${categoryColor === 'indigo' ? 'bg-indigo-500 shadow-indigo-500/50' :
                                                            categoryColor === 'blue' ? 'bg-blue-500 shadow-blue-500/50' :
                                                                categoryColor === 'emerald' ? 'bg-emerald-500 shadow-emerald-500/50' :
                                                                    categoryColor === 'rose' ? 'bg-rose-500 shadow-rose-500/50' :
                                                                        categoryColor === 'amber' ? 'bg-amber-500 shadow-amber-500/50' :
                                                                            'bg-slate-500 shadow-slate-500/50'}`}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right font-mono text-xs text-slate-400">
                                                <input
                                                    title='Stock'
                                                    type="number"
                                                    className="bg-transparent border-none text-right w-16 focus:bg-slate-800/50 rounded p-1 outline-none group-hover:text-slate-200 transition-colors"
                                                    value={item.stock}
                                                    onChange={(e) => updateInventoryItem(item.id, { stock: parseInt(e.target.value) || 0 })}
                                                />
                                            </td>
                                            <td className="px-6 py-5 text-right font-mono text-xs text-slate-400">
                                                <input
                                                    title='Prix unitaire'
                                                    type="number"
                                                    className="bg-transparent border-none text-right w-24 focus:bg-slate-800/50 rounded p-1 outline-none group-hover:text-slate-200 transition-colors"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateInventoryItem(item.id, { unitPrice: parseInt(e.target.value) || 0 })}
                                                />
                                            </td>
                                            <td className="px-8 py-5 text-right font-black text-indigo-400 transition-transform group-hover:scale-105">
                                                {fmtFCFA((item.stock || 0) * (item.unitPrice || 0))}
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <button
                                                    aria-label="Supprimer définitivement"
                                                    onClick={() => {
                                                        if (confirm('Supprimer cet article ?')) deleteInventoryItem(item.id);
                                                    }}
                                                    className="text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-all p-2 hover:bg-rose-500/10 rounded-lg active:scale-90"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-950/30">
                                <td colSpan={5} className="px-8 py-6 text-xs font-black uppercase tracking-[0.3em] text-slate-500">VALORISATION TOTALE DU STOCK (APPROVISIONNEMENT)</td>
                                <td className="px-8 py-6 text-right text-2xl font-black italic tracking-tighter text-white">
                                    {fmtFCFA(stats.supplyCost)}
                                </td>
                                <td className="px-6 py-4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Note Section */}
            <div className={`p-6 rounded-3xl border flex gap-4 ${isDarkMode ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}>
                <Info size={24} className="text-amber-500 shrink-0" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Informations sur les coûts</p>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Les prix saisis ici sont utilisés pour calculer la part "Achat/Approvisionnement" du projet.
                        Si le maître d'ouvrage fournit lui-même ces équipements, désactivez le calcul en haut de page pour
                        que votre bilan financier ne porte que sur vos prestations de services (Installation, Transport, Gestion).
                    </p>
                </div>
            </div>
        </div>
    );
}
