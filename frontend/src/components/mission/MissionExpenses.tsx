import { useState, useEffect } from 'react';
import { Fuel, Receipt, Plus, Trash2, Camera, Calculator } from 'lucide-react';

interface Expense {
    id: string;
    type: 'fuel' | 'other';
    label: string;
    amount: number;
    receiptPhoto?: string;
}

interface MissionExpensesProps {
    expenses?: Expense[];
    fuelStats?: {
        kmStart: number;
        kmEnd: number;
        rate: number; // FCFA/Km
    };
    onChange: (data: { expenses?: Expense[]; fuelStats?: any }) => void;
}

export function MissionExpenses({ expenses = [], fuelStats, onChange }: MissionExpensesProps) {
    const [kmStart, setKmStart] = useState(fuelStats?.kmStart || 0);
    const [kmEnd, setKmEnd] = useState(fuelStats?.kmEnd || 0);
    const rate = fuelStats?.rate || 650; // Default fuel rate in Senegal
    
    const kmTotal = Math.max(0, kmEnd - kmStart);
    const fuelCost = kmTotal * rate;
    const otherTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalGlobal = fuelCost + otherTotal;

    useEffect(() => {
        onChange({ fuelStats: { kmStart, kmEnd, rate } });
    }, [kmStart, kmEnd, rate]);

    const handleAddExpense = () => {
        const newExpense: Expense = {
            id: crypto.randomUUID(),
            type: 'other',
            label: 'Nouveau frais...',
            amount: 0
        };
        onChange({ expenses: [...expenses, newExpense] });
    };

    const handleUpdateExpense = (index: number, field: keyof Expense, value: any) => {
        const newExpenses = [...expenses];
        newExpenses[index] = { ...newExpenses[index], [field]: value };
        onChange({ expenses: newExpenses });
    };

    const handleRemoveExpense = (index: number) => {
        onChange({ expenses: expenses.filter((_, i) => i !== index) });
    };

    const handlePhotoCapture = (index: number) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    const base64 = loadEvent.target?.result as string;
                    handleUpdateExpense(index, 'receiptPhoto', base64);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    return (
        <section className="glass-card !p-8 !rounded-[2.5rem] space-y-8">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-6">
                <h2 className="font-black text-slate-800 dark:text-white uppercase tracking-wider text-sm flex items-center gap-3">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg"><Receipt size={16} className="text-emerald-500" /></div> 
                    Gestion des Frais & Carburant
                </h2>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 rounded-xl font-black text-xs uppercase tracking-widest shadow-inner">
                    Total: {totalGlobal.toLocaleString()} FCFA
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Fuel Calculator */}
                <div className="space-y-6 bg-slate-50/50 dark:bg-slate-900/30 p-6 rounded-3xl border border-slate-200/50 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                        <Fuel className="text-indigo-500" size={18} />
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Calculateur Carburant</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2">Km Départ</label>
                            <input 
                                type="number" 
                                value={kmStart} 
                                onChange={e => setKmStart(Number(e.target.value))}
                                title="Kilométrage au départ"
                                placeholder="0"
                                className="w-full p-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-black focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2">Km Arrivée</label>
                            <input 
                                type="number" 
                                value={kmEnd} 
                                onChange={e => setKmEnd(Number(e.target.value))}
                                title="Kilométrage à l'arrivée"
                                placeholder="0"
                                className="w-full p-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-black focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/60 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-white/5">
                        <div className="flex flex-col">
                            <span className="text-xs font-black uppercase text-slate-400">Consommation</span>
                            <span className="text-lg font-black text-indigo-600">{kmTotal} Km</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-white dark:bg-slate-900/10" />
                        <div className="flex flex-col text-right">
                            <span className="text-xs font-black uppercase text-slate-400">Coût Estimé</span>
                            <span className="text-lg font-black text-indigo-600">{fuelCost.toLocaleString()} FCFA</span>
                        </div>
                    </div>
                </div>

                {/* Other Expenses */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <Calculator className="text-emerald-500" size={18} />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Justificatifs Divers</h3>
                        </div>
                        <button 
                            onClick={handleAddExpense} 
                            aria-label="Ajouter un frais"
                            className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-all"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {expenses.map((exp, i) => (
                            <div key={exp.id} className="flex flex-col gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-4 rounded-2xl group transition-all hover:border-indigo-500/30">
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="text" 
                                        value={exp.label} 
                                        onChange={e => handleUpdateExpense(i, 'label', e.target.value)}
                                        aria-label="Libellé du frais"
                                        placeholder="Libellé (ex: Hôtel, Repas...)"
                                        className="flex-1 bg-transparent border-none text-xs font-bold text-slate-800 dark:text-white focus:ring-0 p-0"
                                    />
                                    <input 
                                        type="number" 
                                        value={exp.amount} 
                                        onChange={e => handleUpdateExpense(i, 'amount', Number(e.target.value))}
                                        title="Montant du frais"
                                        placeholder="0"
                                        className="w-24 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-xs font-black text-emerald-600 text-right p-1.5 focus:ring-0 font-mono"
                                    />
                                    <button 
                                        onClick={() => handleRemoveExpense(i)} 
                                        aria-label="Supprimer"
                                        className="p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                
                                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                    <button 
                                        onClick={() => handlePhotoCapture(i)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all"
                                    >
                                        <Camera size={12} />
                                        {exp.receiptPhoto ? 'Changer le reçu' : 'Scanner Reçu'}
                                    </button>

                                    {exp.receiptPhoto && (
                                        <div 
                                            className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 cursor-pointer hover:scale-110 transition-transform group/img"
                                            onClick={() => {
                                                const win = window.open();
                                                win?.document.write(`<img src="${exp.receiptPhoto}" style="max-width:100%; height:auto;" />`);
                                            }}
                                        >
                                            <img src={exp.receiptPhoto} alt="Aperçu" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                <Plus size={12} className="text-white" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {expenses.length === 0 && (
                            <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-2xl">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucun frais supplémentaire</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
