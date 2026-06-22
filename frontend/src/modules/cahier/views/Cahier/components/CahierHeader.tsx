import React from 'react';
import { 
  History, 
  Save, 
  RefreshCw, 
  Settings, 
  FileText, 
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Clock
} from 'lucide-react';

interface CahierHeaderProps {
  projectName?: string;
  isSaving?: boolean;
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
  projectName = 'Projet Sans Nom',
  isSaving = false,
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
    <div className="mb-6 space-y-6">
      {/* 🚀 Hero Header Premium */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-700/60 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none translate-y-1/3 -translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-md">
                {projectName}
              </span>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                Workspace
              </span>
            </div>
            
            <h1 className="text-3xl font-black text-white md:text-4xl lg:text-5xl tracking-tight">
              {isEditing ? 'Édition : ' : ''}
              {documentMode === 'cahier' ? 'Cahier des Charges' : documentMode === 'contrat' ? 'Contrat de Prestation' : 'Modèle de Stratégie'}
            </h1>
            
            <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
              <span className="text-indigo-400 font-bold">{selectedRole}</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>Généré et synchronisé automatiquement</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] ${
                showHistory 
                  ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400 shadow-lg shadow-indigo-500/20' 
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <History size={16} />
              <span className="hidden sm:inline">Historique</span>
            </button>

            {isEditing ? (
              <>
                <button
                  onClick={onSave}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/40 transition-all duration-300 hover:bg-emerald-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-emerald-500/30 active:scale-95"
                >
                  <Save size={16} />
                  Enregistrer
                </button>
                <button
                  onClick={onEditToggle}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition-all hover:bg-white/10 hover:scale-[1.02]"
                >
                  Fermer
                </button>
              </>
            ) : (
              <button
                onClick={onExportWord}
                className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all duration-300 hover:bg-blue-500 hover:scale-[1.02] shadow-lg shadow-blue-900/40 active:scale-95"
              >
                <FileText size={16} />
                Export .docx
              </button>
            )}

            <div className="h-8 w-px bg-white/10 mx-2 hidden sm:block" />

            <button
              onClick={() => setShowAdvancedSections(!showAdvancedSections)}
              title="Paramètres avancés"
              className={`p-3 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
                showAdvancedSections 
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/20' 
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Settings size={18} />
            </button>

            <button
              onClick={onReset}
              title="Réinitialiser par défaut"
              className="p-3 rounded-2xl border border-white/10 bg-white/5 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all duration-300 hover:scale-[1.02]"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 📊 Barre d'état documentaire */}
      <div className="flex flex-wrap items-center gap-3 px-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span className="text-slate-500">Mode:</span>
          {isEditing ? <span className="text-amber-400 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Édition</span> : <span className="text-indigo-400 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Lecture Seule</span>}
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span className="text-slate-500">Document:</span>
          <span className="text-white">{documentMode === 'cahier' ? 'Technique' : documentMode === 'contrat' ? 'Juridique' : 'Opérationnel'}</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span className="text-slate-500 flex items-center gap-1.5"><Clock size={12} /> Modifié:</span>
          <span className="text-white">À l'instant</span>
        </div>

        <div className="lg:ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/50 border border-slate-800/50 text-[10px] font-bold uppercase tracking-widest">
          {isSaving ? (
            <span className="text-amber-400 flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} />
              Sauvegarde en cours...
            </span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-2">
              <ShieldCheck size={14} />
              Synchronisé au Cloud
            </span>
          )}
        </div>
      </div>

    </div>
  );
};
