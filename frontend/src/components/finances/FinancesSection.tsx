import { useState } from 'react';
import {
    FileSpreadsheet,
    Download,
    Upload,
    Trash2,
    Save,
    Plus,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react';
import { useFinances } from '../../hooks/useFinances';
import { fmtFCFA } from '../../utils/format';

interface Props {
    project: any;
    onUpdate: (patch: any) => Promise<void>;
}

export function FinancesSection({ project, onUpdate }: Props) {
    const { devis, addDevisItem, deleteDevisItem, importDevisList, resetToDefault, updatePlannedCost } = useFinances();
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [previousConfig, setPreviousConfig] = useState<any>(null);

    const devisItems: any[] = devis.report || [];

    const handleExcel = async () => {
        const { utils, writeFile } = await import('xlsx');
        const data = devisItems.map((item: any) => ({
            ID: item.id,
            Poste_de_Depense: item.label,
            Region: item.region,
            Prevision_Qte: item.qty,
            Prevision_PU: item.unit,
            Total_Prevu: item.planned,
            Reel_Qte: item.rq,
            Reel_PU: item.ru,
            Total_Reel: item.realTotal,
            Ecart_Marge: item.margin
        }));
        const wb = utils.book_new();
        utils.book_append_sheet(wb, utils.json_to_sheet(data.length ? data : [{ info: 'Aucun poste' }]), 'Devis vs Reel');
        writeFile(wb, `devis_${project?.name || 'projet'}.xlsx`);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportErrors([]);
        try {
            let rawData: any[] = [];
            if (file.name.endsWith('.csv')) {
                const text = await file.text();
                const lines = text.split('\n').filter((l: string) => l.trim());
                if (lines.length > 1) {
                    const headers = lines[0].split(',').map((h: string) => h.replace(/^"|"$/g, '').trim());
                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(',').map((c: string) => c.replace(/^"|"$/g, '').trim());
                        const row: any = {};
                        headers.forEach((h: string, j: number) => { row[h] = cols[j]; });
                        rawData.push(row);
                    }
                }
            } else {
                const { read, utils } = await import('xlsx');
                const wb = read(await file.arrayBuffer(), { type: 'array' });
                rawData = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            }
            const errors: string[] = [];
            rawData.forEach((row: any, i: number) => {
                if (!row.Poste_de_Depense && !row.Label && !row.label) {
                    errors.push(`Ligne ${i + 2}: Colonne 'Poste_de_Depense' manquante.`);
                }
            });
            if (errors.length > 0) { setImportErrors(errors); e.target.value = ''; return; }
            
            // On sauvegarde l'état avant l'import pour le bouton annuler
            setPreviousConfig(JSON.parse(JSON.stringify(project?.config || {})));
            
            await importDevisList(rawData);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setImportErrors([`Erreur: ${err?.message || 'Format invalide'}`]);
        }
        e.target.value = '';
    };

    const handleSaveToServer = async () => {
        setIsSaving(true);
        try {
            await onUpdate({ config: { ...project.config } });
            setPreviousConfig(null); // Clear undo history after save
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } finally { setIsSaving(false); }
    };

    const handleUndo = async () => {
        if (previousConfig && project?.id) {
            const { db } = await import('../../store/db');
            await db.projects.update(project.id, { config: previousConfig });
            setPreviousConfig(null);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        }
    };

    return (
        <div className="space-y-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight mb-1">
                        <FileSpreadsheet className="text-indigo-500" />
                        Postes Budgetaires (Devis)
                    </h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {devisItems.length} postes — sauvegarde PostgreSQL via bouton
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={handleExcel} className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all active:scale-95">
                        <Download size={15} /> EXPORTER EXCEL
                    </button>
                    <label className="flex items-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white font-black text-xs rounded-xl transition-all cursor-pointer active:scale-95">
                        <Upload size={15} /> IMPORTER
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
                    </label>
                    <button onClick={async () => {
                        if (confirm("Voulez-vous vraiment réinitialiser aux valeurs d'exemple de base ? Vos données importées seront effacées.")) {
                            await resetToDefault();
                            setSuccess(true);
                            setTimeout(() => setSuccess(false), 3000);
                        }
                    }} className="flex items-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl transition-all active:scale-95">
                        RÉINITIALISER
                    </button>
                    {previousConfig && (
                        <button onClick={handleUndo} className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition-all active:scale-95">
                            ANNULER L'IMPORT
                        </button>
                    )}
                    <button onClick={handleSaveToServer} disabled={isSaving} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50">
                        <Save size={15} /> {isSaving ? 'Sauvegarde...' : 'SAUVEGARDER SERVEUR'}
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {success && (
                <div className="flex items-center gap-3 p-4 bg-emerald-900/20 border border-emerald-800 text-emerald-300 rounded-2xl text-sm font-bold">
                    <CheckCircle2 size={16} /> Operation reussie !
                </div>
            )}
            {importErrors.length > 0 && (
                <div className="p-4 bg-rose-900/20 border border-rose-800 text-rose-300 rounded-2xl">
                    <div className="flex items-center gap-2 font-black text-xs uppercase mb-2"><AlertTriangle size={14} /> Erreurs d'import</div>
                    <ul className="list-disc list-inside text-xs space-y-1">{importErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                </div>
            )}

            {/* Table */}
            <div className="bg-white/5 rounded-[2rem] border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            {/* Row 1: Group headers */}
                            <tr className="bg-slate-950/70 border-b border-white/5">
                                <th colSpan={3} className="px-4 py-2 text-xs font-black text-slate-400 uppercase tracking-widest text-center border-r border-white/10">
                                    DONNÉE FINANCIÈRE
                                </th>
                                <th colSpan={3} className="px-4 py-2 text-xs font-black text-blue-400 uppercase tracking-widest text-center border-r border-white/10">
                                    COÛT PROJET (PRÉVISION)
                                </th>
                                <th colSpan={3} className="px-4 py-2 text-xs font-black text-amber-400 uppercase tracking-widest text-center border-r border-white/10">
                                    CHARGE RÉELLE
                                </th>
                                <th className="px-4 py-2 text-xs font-black text-emerald-400 uppercase tracking-widest text-center">
                                    MARGE
                                </th>
                                <th></th>
                            </tr>
                            {/* Row 2: Column headers */}
                            <tr className="bg-slate-950/50 border-b border-white/5">
                                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-left border-r border-white/5">ID</th>
                                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-left border-r border-white/5">Poste de Dépense</th>
                                <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-center border-r border-white/10">Région</th>
                                <th className="px-4 py-3 text-xs font-black text-blue-300 uppercase tracking-widest text-right">Prév. Qté</th>
                                <th className="px-4 py-3 text-xs font-black text-blue-300 uppercase tracking-widest text-right">Prév. PU (FCFA)</th>
                                <th className="px-4 py-3 text-xs font-black text-blue-300 uppercase tracking-widest text-right border-r border-white/10">Total Prévu</th>
                                <th className="px-4 py-3 text-xs font-black text-amber-300 uppercase tracking-widest text-right">Réel Qté</th>
                                <th className="px-4 py-3 text-xs font-black text-amber-300 uppercase tracking-widest text-right">Réel PU (FCFA)</th>
                                <th className="px-4 py-3 text-xs font-black text-amber-300 uppercase tracking-widest text-right border-r border-white/10">Total Réel</th>
                                <th className="px-4 py-3 text-xs font-black text-emerald-400 uppercase tracking-widest text-right">Écart (FCFA)</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {devisItems.length === 0 ? (
                                <tr><td colSpan={11} className="py-16 text-center text-slate-600 font-bold text-sm">Aucun poste. Ajoutez-en ci-dessous ou importez un Excel.</td></tr>
                            ) : devisItems.map((item: any) => (
                                <tr key={item.id} className="group hover:bg-white/5 transition-all">
                                    {/* DONNÉE FINANCIÈRE */}
                                    <td className="px-4 py-3 text-xs text-slate-500 border-r border-white/5">{item.id}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-white border-r border-white/5">{item.label}</td>
                                    <td className="px-4 py-3 text-xs font-black text-indigo-400 uppercase text-center border-r border-white/10">{item.region}</td>

                                    {/* COÛT PROJET — éditables */}
                                    <td className="px-2 py-1 text-right">
                                        <input type="number" defaultValue={item.qty}
                                            onBlur={e => updatePlannedCost(item.id, 'qty', Number(e.target.value) || 0)}
                                            className="w-20 bg-transparent text-right text-sm text-blue-200 border border-transparent hover:border-blue-400/40 focus:border-blue-500 rounded px-2 py-1 outline-none transition-all" />
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        <input type="number" defaultValue={item.unit}
                                            onBlur={e => updatePlannedCost(item.id, 'unit', Number(e.target.value) || 0)}
                                            className="w-28 bg-transparent text-right text-sm text-blue-200 border border-transparent hover:border-blue-400/40 focus:border-blue-500 rounded px-2 py-1 outline-none transition-all" />
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-blue-400 border-r border-white/10">{item.planned.toLocaleString('fr-FR')}</td>

                                    {/* CHARGE RÉELLE — éditables et autonomes */}
                                    <td className="px-2 py-1 text-right">
                                        <input type="number" defaultValue={item.rq ?? item.qty}
                                            onBlur={e => updateRealCost(item.id, 'qty', Number(e.target.value) || 0)}
                                            className="w-20 bg-transparent text-right text-sm text-amber-200 border border-transparent hover:border-amber-400/40 focus:border-amber-500 rounded px-2 py-1 outline-none transition-all" />
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                        <input type="number" defaultValue={item.ru ?? item.unit}
                                            onBlur={e => updateRealCost(item.id, 'unit', Number(e.target.value) || 0)}
                                            className="w-28 bg-transparent text-right text-sm text-amber-200 border border-transparent hover:border-amber-400/40 focus:border-amber-500 rounded px-2 py-1 outline-none transition-all" />
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-amber-300 border-r border-white/10">{item.realTotal.toLocaleString('fr-FR')}</td>

                                    {/* MARGE */}
                                    <td className={`px-4 py-3 text-right text-sm font-black ${item.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{item.margin.toLocaleString('fr-FR')}</td>
                                    <td className="px-2 py-3">
                                        <button onClick={() => deleteDevisItem(item.id)} title="Supprimer" className="p-2 opacity-0 group-hover:opacity-100 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {devisItems.length > 0 && (
                            <tfoot className="bg-slate-950/60 border-t-2 border-white/10">
                                <tr>
                                    <td colSpan={3} className="px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-widest border-r border-white/10">TOTAL — {devisItems.length} postes</td>
                                    <td colSpan={2} className="px-4 py-4" />
                                    <td className="px-4 py-4 text-right text-base font-black text-blue-400 border-r border-white/10">{devisItems.reduce((s: number, i: any) => s + (i.planned || 0), 0).toLocaleString('fr-FR')}</td>
                                    <td colSpan={2} className="px-4 py-4" />
                                    <td className="px-4 py-4 text-right text-base font-black text-amber-300 border-r border-white/10">{devisItems.reduce((s: number, i: any) => s + (i.realTotal || 0), 0).toLocaleString('fr-FR')}</td>
                                    <td className={`px-4 py-4 text-right text-base font-black ${devis.globalMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{devis.globalMargin.toLocaleString('fr-FR')}</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Quick Add */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-stretch gap-4">
                <input id="fin_label" placeholder="Libelle du poste (ex: Transport materiel)" title="Libelle" className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                <select id="fin_region" title="Region" className="bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="Global">Global</option>
                    <option value="Kaffrine">Kaffrine</option>
                    <option value="Tambacounda">Tambacounda</option>
                </select>
                <input id="fin_qty" type="number" placeholder="Qte" title="Quantite" defaultValue={1} className="w-24 bg-slate-950 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                <input id="fin_unit" type="number" placeholder="P.U" title="Prix unitaire FCFA" defaultValue={0} className="w-32 bg-slate-950 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                <button
                    onClick={() => {
                        const lbl = (document.getElementById('fin_label') as HTMLInputElement)?.value;
                        const reg = (document.getElementById('fin_region') as HTMLSelectElement)?.value;
                        const qty = Number((document.getElementById('fin_qty') as HTMLInputElement)?.value) || 1;
                        const unit = Number((document.getElementById('fin_unit') as HTMLInputElement)?.value) || 0;
                        if (lbl) {
                            addDevisItem({ label: lbl, region: reg || 'Global', qty, unit });
                            (document.getElementById('fin_label') as HTMLInputElement).value = '';
                        }
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all active:scale-95"
                >
                    <Plus size={15} /> AJOUTER
                </button>
            </div>
        </div>
    );
}
