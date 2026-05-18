import React from 'react';
import { 
  History, 
  Save, 
  RefreshCw, 
  Settings, 
  FileText, 
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface CahierHeaderProps {
  selectedRole: string;
  documentMode: 'cahier' | 'contrat' | 'strategie';
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  showAdvancedSections: boolean;
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  setShowAdvancedSections: (show: boolean) => void;
  onSave: () => void;
  onReset: () => void;
  onExportWord: () => void;
  onEditToggle: () => void;
}

export const CahierHeader: React.FC<CahierHeaderProps> = ({
  selectedRole,
  documentMode,
  isEditing,
  hasUnsavedChanges,
  showAdvancedSections,
  showHistory,
  setShowHistory,
  setShowAdvancedSections,
  onSave,
  onReset,
  onExportWord,
  onEditToggle,
}) => {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          <span>Documents</span>
          <ChevronRight size={10} />
          <span className="text-indigo-400">{selectedRole}</span>
          <ChevronRight size={10} />
          <span className="text-white">{documentMode === 'cahier' ? 'Référentiel Technique' : documentMode === 'contrat' ? 'Clauses Contractuelles' : 'Stratégie Opérationnelle'}</span>
        </div>
        <h1 className="text-2xl font-black text-white md:text-3xl lg:text-4xl">
          {isEditing ? 'Édition du ' : ''}
          {documentMode === 'cahier' ? 'Cahier des Charges' : documentMode === 'contrat' ? 'Contrat de Prestation' : 'Modèle de Stratégie'}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
            showHistory 
              ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400' 
              : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10'
          }`}
        >
          <History size={14} />
          <span className="hidden sm:inline">Historique</span>
        </button>

        {isEditing ? (
          <>
            <button
              onClick={onSave}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 active:scale-95"
            >
              <Save size={14} />
              Enregistrer
            </button>
            <button
              onClick={onEditToggle}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-white/10"
            >
              Annuler
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEditToggle}
              className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-indigo-400 transition-all hover:bg-indigo-500/20"
            >
              Éditer
            </button>
            <button
              onClick={onExportWord}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-blue-500 active:scale-95 shadow-lg shadow-blue-900/20"
            >
              <FileText size={14} />
              Export .docx
            </button>
          </>
        )}

        <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

        <button
          onClick={() => setShowAdvancedSections(!showAdvancedSections)}
          title="Paramètres avancés"
          className={`p-2.5 rounded-xl border transition-all ${
            showAdvancedSections 
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400' 
              : 'border-white/5 bg-white/5 text-slate-500 hover:text-slate-300'
          }`}
        >
          <Settings size={18} />
        </button>

        <button
          onClick={onReset}
          title="Réinitialiser par défaut"
          className="p-2.5 rounded-xl border border-white/5 bg-white/5 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 transition-all"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {hasUnsavedChanges && !isEditing && (
        <div className="absolute top-24 right-6 flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
          <AlertCircle size={12} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-amber-500">Modifications non publiées</span>
        </div>
      )}
    </div>
  );
};
