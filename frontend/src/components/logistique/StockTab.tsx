import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  Check,
  X,
} from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';
import { useProject } from '../../contexts/ProjectContext';
import { fmtNum } from '../../utils/format';
import toast from 'react-hot-toast';
import * as XLSX from '../../utils/safeExcel';

const getTypeColor = (typeStr: string) => {
  const t = (typeStr || '').toUpperCase();
  if (t.includes('KIT')) return 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 focus:border-indigo-500/50';
  if (t.includes('SERVICE') || t.includes('PRESTATION')) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 focus:border-emerald-500/50';
  if (t.includes('EQUIP') || t.includes('MATER')) return 'text-amber-400 bg-amber-500/10 border border-amber-500/20 focus:border-amber-500/50';
  if (t.includes('CONSOM')) return 'text-rose-400 bg-rose-500/10 border border-rose-500/20 focus:border-rose-500/50';
  return 'text-slate-300 bg-slate-800/50 border border-slate-700/50 focus:border-slate-600';
};

interface StockTabProps {
  searchQuery?: string;
}

export default function StockTab({ searchQuery = '' }: StockTabProps) {
  const {
    warehouseStats,
    project,
  } = useLogistique();
  const { updateProject } = useProject();

  const currentComposition = project?.config?.kitComposition || [];
  
  // Extract dynamic regions from warehouses. Fallback to Kaffrine/Tambacounda if none.
  const activeRegions = Array.from(new Set(warehouseStats?.map((w: any) => w.region) || ['Kaffrine', 'Tambacounda'])).filter(Boolean) as string[];
  if (activeRegions.length === 0) {
    activeRegions.push('Kaffrine', 'Tambacounda');
  }

  const [tableData, setTableData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteRowId, setConfirmDeleteRowId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!project || initialized.current) return;

    if (currentComposition.length > 0) {
      setTableData(currentComposition.map((item: any) => ({
        id: item.id || `mat_${Math.random()}`,
        type: item.type || 'KIT PRINCIPAL',
        category: item.category || 'SERVICE',
        label: item.label || '',
        unit: item.unit || 'U',
        regionalQuantities: item.regionalQuantities || {},
      })));
      initialized.current = true;
    } else if (currentComposition.length === 0) {
      setTableData([]);
      initialized.current = true;
    }
  }, [project, currentComposition]);

  const updateRow = (index: number, field: string, value: string) => {
    const newData = [...tableData];
    newData[index][field] = value;
    setTableData(newData);
  };

  const updateRegionalQty = (index: number, region: string, value: number) => {
    const newData = [...tableData];
    if (!newData[index].regionalQuantities) newData[index].regionalQuantities = {};
    newData[index].regionalQuantities[region] = value;
    setTableData(newData);
  };

  const addRow = () => {
    setTableData([...tableData, {
      id: `mat_${Date.now()}`,
      type: tableData.length > 0 ? tableData[tableData.length - 1].type : 'KIT PRINCIPAL',
      category: tableData.length > 0 ? tableData[tableData.length - 1].category : 'EQUIPEMENTS',
      label: '',
      unit: 'U',
      regionalQuantities: {},
    }]);
  };

  const removeRow = (index: number) => {
    const newData = [...tableData];
    newData.splice(index, 1);
    setTableData(newData);
  };

  const handleSave = async () => {
    if (!project) return;
    setIsSaving(true);
    try {
      // Filter out completely empty placeholder rows before saving to database
      const validData = tableData.filter(row => row.label && row.label.trim() !== '');
      
      const newConfig = { 
        ...project.config, 
        kitComposition: validData,
      };
      await updateProject({ config: newConfig }, project.id);
      
      toast.success('Tableau enregistré avec succès ✓');
    } catch (e) {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const wsData = [];
      const header = ['TYPE', 'CATEGORIE', 'DESIGNATION', 'UNIT'];
      activeRegions.forEach(r => header.push(`QTE ${r.toUpperCase()}`));
      header.push('PL');
      wsData.push(header);

      tableData.forEach(row => {
         const rowData = [
           row.type || '',
           row.category || '',
           row.label || '',
           row.unit || '',
         ];
         let total = 0;
         activeRegions.forEach(r => {
            const qty = row.regionalQuantities?.[r] || 0;
            rowData.push(qty);
            total += qty;
         });
         rowData.push(total);
         wsData.push(rowData);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stock_Materiel");
      await XLSX.writeFile(wb, "Referentiel_Stock.xlsx");
      toast.success('Export réussi');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'export');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const ab = evt.target?.result as ArrayBuffer;
        if (!ab) throw new Error('Impossible de lire le fichier');

        const uint8Array = new Uint8Array(ab);
        const wb = await XLSX.read(uint8Array, { type: 'array' });
        
        if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
          throw new Error('Fichier Excel invalide ou vide');
        }

        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any[][]>(ws, { header: 1 });
        
        if (!data || data.length < 2 || !data[0]) {
          throw new Error('Fichier vide ou format invalide');
        }

        const headers = data[0].map((h: any) => typeof h === 'string' ? h.toUpperCase().trim() : '');
        
        const newTableData = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !Array.isArray(row) || row.length === 0 || !row.some(c => !!c)) continue; 
          
          const typeIdx = headers.indexOf('TYPE');
          const catIdx = headers.indexOf('CATEGORIE');
          const desIdx = headers.indexOf('DESIGNATION');
          const unitIdx = headers.indexOf('UNIT');
          
          const item = {
            id: `mat_${Date.now()}_${i}`,
            type: typeIdx >= 0 ? (row[typeIdx] || 'KIT PRINCIPAL') : 'KIT PRINCIPAL',
            category: catIdx >= 0 ? (row[catIdx] || 'SERVICE') : 'SERVICE',
            label: desIdx >= 0 ? (row[desIdx] || '') : '',
            unit: unitIdx >= 0 ? (row[unitIdx] || 'U') : 'U',
            regionalQuantities: {} as Record<string, number>
          };

          headers.forEach((h, colIdx) => {
             if (h.startsWith('QTE ')) {
               const region = h.replace('QTE ', '').trim();
               const formattedRegion = region.charAt(0).toUpperCase() + region.slice(1).toLowerCase();
               item.regionalQuantities[formattedRegion] = Number(row[colIdx]) || 0;
             }
          });

          newTableData.push(item);
        }
        
        setTableData(newTableData);
        toast.success('Fichier importé avec succès. N\'oubliez pas d\'enregistrer !');
      } catch (err: any) {
        console.error('Import Excel Error:', err);
        toast.error(err.message || 'Erreur lors de la lecture du fichier Excel');
      }
    };
    reader.readAsArrayBuffer(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [colFilters, setColFilters] = useState({ type: '', designation: '' });

  // Optional: filter table by search query
  const filteredData = tableData.filter(row => {
    let match = true;
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      match = match && (
        (row.label || '').toLowerCase().includes(lowerQ) ||
        (row.category || '').toLowerCase().includes(lowerQ) ||
        (row.type || '').toLowerCase().includes(lowerQ)
      );
    }
    if (colFilters.type) {
      match = match && (row.type || '').toLowerCase().includes(colFilters.type.toLowerCase());
    }
    if (colFilters.designation) {
      const q = colFilters.designation.toLowerCase();
      match = match && (
        (row.label || '').toLowerCase().includes(q) ||
        (row.category || '').toLowerCase().includes(q)
      );
    }
    return match;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full flex flex-col">
      {/* Premium Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between bg-slate-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-[2.5rem] shadow-2xl shrink-0">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Box className="text-white" size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight leading-tight">STOCK & MATÉRIEL</h3>
            <div className="flex items-center gap-2 mt-1 mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                <div className="w-1 h-1 rounded-full bg-current animate-pulse" />
                Tableau Master
              </span>
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">• Édition Rapide</span>
            </div>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Ce panneau vous permet de définir le référentiel complet de vos équipements, kits et consommables (avec l'unité de mesure et les quantités par région). Ces données sont primordiales car elles alimentent les ordres de mission et l'outil de planification de façon dynamique.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImport} 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all shadow-xl shadow-slate-900/20"
          >
            <Upload size={16} />
            Importer
          </button>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all shadow-xl shadow-emerald-900/20"
          >
            <Download size={16} />
            Exporter
          </button>

          <div className="w-px h-8 bg-slate-800 mx-2 hidden sm:block" />

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50"
          >
            {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
            Enregistrer
          </button>
        </div>
      </div>

      {/* Spreadsheet View */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl flex-1 overflow-hidden flex flex-col min-h-[500px]">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1200px]">
             <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md shadow-sm border-b border-slate-800/60">
               <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
                 <th className="px-4 py-3 w-40 align-top">
                   <div className="flex flex-col gap-2">
                     <span>TYPE</span>
                     <input 
                       type="text" 
                       placeholder="Filtrer..." 
                       value={colFilters.type}
                       onChange={e => setColFilters({...colFilters, type: e.target.value})}
                       className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-300 font-normal normal-case tracking-normal outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600"
                     />
                   </div>
                 </th>
                 <th className="px-4 py-3 align-top">
                   <div className="flex flex-col gap-2">
                     <span>DESIGNATION (AVEC CATÉGORIE)</span>
                     <input 
                       type="text" 
                       placeholder="Filtrer..." 
                       value={colFilters.designation}
                       onChange={e => setColFilters({...colFilters, designation: e.target.value})}
                       className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-300 font-normal normal-case tracking-normal outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600"
                     />
                   </div>
                 </th>
                 <th className="px-4 py-3 w-20 text-center align-top">
                   <div className="flex flex-col gap-2 h-full justify-between">
                     <span>UNIT</span>
                   </div>
                 </th>
                 {activeRegions.map(r => (
                   <th key={r} className="px-4 py-3 w-32 text-right align-top" title={`Quantité pour la région ${r}`}>
                     <div className="flex flex-col gap-2 h-full justify-between">
                       <span>QTE {r.toUpperCase()}</span>
                     </div>
                   </th>
                 ))}
                 <th className="px-4 py-3 w-32 text-right bg-indigo-950/10 text-indigo-400 align-top">
                   <div className="flex flex-col gap-2 h-full justify-between">
                     <span>PL</span>
                   </div>
                 </th>
                 <th className="px-4 py-3 w-12 text-center align-top"></th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-800/40 text-sm">
               {filteredData.map((row) => {
                 const originalIndex = tableData.findIndex(r => r.id === row.id);
                 const total = activeRegions.reduce((sum, r) => sum + (Number(row.regionalQuantities?.[r]) || 0), 0);
                 
                 return (
                   <tr key={row.id} className="hover:bg-slate-800/20 transition-colors group">
                     <td className="px-4 py-3">
                        <input 
                          value={row.type} 
                          onChange={(e) => updateRow(originalIndex, 'type', e.target.value)} 
                          className={`w-full outline-none uppercase placeholder-slate-700 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${getTypeColor(row.type)}`} 
                          placeholder="KIT PRINCIPAL"
                        />
                     </td>
                     <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <input 
                            value={row.category} 
                            onChange={(e) => updateRow(originalIndex, 'category', e.target.value)} 
                            className="w-28 bg-slate-800/50 text-slate-400 focus:text-white focus:bg-indigo-500/20 text-[9px] font-black uppercase px-2 py-1.5 rounded-lg outline-none border border-slate-700/50 focus:border-indigo-500/50 transition-all" 
                            placeholder="CATÉGORIE" 
                          />
                          <input 
                            value={row.label} 
                            onChange={(e) => updateRow(originalIndex, 'label', e.target.value)} 
                            className="flex-1 bg-transparent border-none text-slate-200 text-sm outline-none font-medium placeholder-slate-700 focus:text-white" 
                            placeholder="Désignation du matériel..." 
                          />
                        </div>
                     </td>
                     <td className="px-4 py-3 text-center">
                        <input 
                          value={row.unit} 
                          onChange={(e) => updateRow(originalIndex, 'unit', e.target.value)} 
                          className="w-full bg-transparent border-none text-slate-500 focus:text-slate-300 text-xs text-center outline-none font-mono uppercase transition-colors" 
                          placeholder="U"
                        />
                     </td>
                     {activeRegions.map(r => (
                        <td key={r} className="px-4 py-3 text-right">
                          <input 
                            type="number" 
                            value={row.regionalQuantities?.[r] || ''} 
                            onChange={(e) => updateRegionalQty(originalIndex, r, Number(e.target.value))} 
                            className="w-full bg-transparent border-none text-indigo-300/80 text-right font-mono text-sm outline-none focus:text-indigo-300 transition-colors" 
                            placeholder="0"
                          />
                        </td>
                     ))}
                     <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold text-sm bg-indigo-950/5">
                        {total > 0 ? fmtNum(total) : '-'}
                     </td>
                     <td className="px-2 py-3 text-center">
                        {confirmDeleteRowId === row.id ? (
                          <div className="flex items-center justify-center gap-1 animate-in zoom-in-95 duration-200">
                            <button 
                              onClick={() => { removeRow(originalIndex); setConfirmDeleteRowId(null); }}
                              className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg transition-colors shadow-sm"
                              title="Confirmer la suppression"
                            >
                              <Check size={16}/>
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteRowId(null)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                              title="Annuler"
                            >
                              <X size={16}/>
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setConfirmDeleteRowId(row.id)} 
                            className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Supprimer la ligne"
                          >
                            <Trash2 size={16}/>
                          </button>
                        )}
                     </td>
                   </tr>
                 );
               })}
             </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <button 
            onClick={addRow} 
            className="flex items-center gap-2 px-4 py-2 text-indigo-400 hover:text-white hover:bg-indigo-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
          >
            <Plus size={16}/> Ajouter une ligne
          </button>
          
          {tableData.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                <span className="text-xs font-bold text-rose-500 mr-2 uppercase tracking-widest">Sûr ?</span>
                <button 
                  onClick={() => {
                    setTableData([]);
                    setConfirmClear(false);
                  }}
                  className="px-4 py-2 bg-rose-500/20 text-rose-400 border border-rose-500/50 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/20"
                >
                  OUI
                </button>
                <button 
                  onClick={() => setConfirmClear(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-colors"
                >
                  NON
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-2 px-4 py-2 text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
              >
                <Trash2 size={16}/> Tout supprimer
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
