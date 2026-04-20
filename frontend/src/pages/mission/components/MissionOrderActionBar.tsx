/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Copy,
  Sparkles,
  Settings,
  Smartphone,
  RefreshCw,
  Save,
  ListChecks,
  Fingerprint,
  Bell,
  Download,
  ChevronDown,
  MapIcon,
  DollarSign
} from 'lucide-react';
import { ActionBar } from '../../../components';
import { getTemplates } from '../../../services/missionTemplates';

const Dropdown = ({ icon, label, isOpen, onToggle, children }: any) => {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs ${
          isOpen ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
        }`}
      >
        {icon}
        {label && <span>{label}</span>}
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 origin-top-right"
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const MissionOrderActionBar = (props: any) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  const {
    formData,
    currentMissionId,
    role,
    isSyncing,
    isSyncingServer,
    isDirty,
    showAudit,
    unreadCount = 0,
    onNewMission,
    onDuplicate,
    onTemplateSelect,
    onConfigToggle,
    onToggleFeature,
    onToggleSimplifiedMode,
    onNotificationsToggle,
    onAuditToggle,
    onSyncFromServer,
    onUpdateField,
    onExportExcel,
    onExportWord,
    onExportPDF,
    onSave,
    onValidate,
    onSubmit,
    isCertified,
    isSubmitted,
    isSimplifiedMode,
  } = props;

  const isAdmin = ['ADMIN', 'ADMIN_PROQUELEC', 'DG_PROQUELEC'].includes(role || '');

  return (
    <ActionBar className="no-print !bg-slate-950/90 backdrop-blur-xl border-t border-white/5 px-4 py-2 shadow-2xl">

      <div className="flex flex-wrap items-center justify-between gap-4">

        {/* 📝 TITRE & INFOS */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!isCertified && !isSubmitted ? (
               <input
                 type="text"
                 value={formData.purpose || ''}
                 onChange={(e) => onUpdateField('purpose', e.target.value.toUpperCase())}
                 placeholder="OBJET DE LA MISSION..."
                 className="bg-transparent border-none outline-none text-[9px] font-extrabold text-white/70 placeholder:text-slate-600 w-full max-w-[280px] focus:ring-0 p-0 tracking-tight"
               />
            ) : (
              <h4 className="text-[9px] font-extrabold text-white/70 truncate uppercase tracking-tight max-w-[280px]">
                {formData.purpose || 'Mission Sans Titre'}
              </h4>
            )}
            <div className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold flex items-center gap-1 ${
              isCertified ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
              isSubmitted ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
              'bg-slate-500/10 text-slate-400 border border-slate-500/20'
            }`}>
              <div className={`w-1 h-1 rounded-full ${
                isCertified ? 'bg-emerald-400 animate-pulse' : 
                isSubmitted ? 'bg-blue-400' : 
                'bg-slate-400'
              }`} />
              {isCertified ? 'SIGNÉE' : isSubmitted ? 'ATTENTE' : 'BROUILLON'}
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-medium truncate">
            {formData.orderNumber && !formData.orderNumber.startsWith('TEMP-') ? `${formData.orderNumber} • ` : ''}
            {formData.date || 'Date non définie'} • {formData.region || 'Localisation à préciser'}
          </span>
        </div>

        {/* ⚡ ACTIONS PRINCIPALES */}
        <div className="flex items-center gap-2">

          <button
            onClick={onSave}
            disabled={isSyncing || isSyncingServer || isSubmitted || isCertified}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all shadow-lg active:scale-95 ${
              isSubmitted || isCertified
                ? 'bg-slate-800 text-slate-600'
                : isDirty
                ? 'bg-orange-500 text-white shadow-orange-500/20'
                : 'bg-blue-600 text-white shadow-blue-500/20'
            }`}
          >
            <Save size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSubmitted || isCertified
              ? 'VERROUILLÉ'
              : isSyncing
              ? 'SYNC...'
              : isDirty
              ? 'SAUVEGARDER*'
              : 'SAUVEGARDÉ'}
          </button>

          {!isSubmitted && !isAdmin && (
            <button
              onClick={() => window.confirm('Soumettre la mission ?') && onSubmit()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
            >
              <ListChecks size={14}/> SOUMETTRE
            </button>
          )}

          {isAdmin && !isCertified && (
            <button
              onClick={onValidate}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Fingerprint size={14}/> VALIDER
            </button>
          )}

        </div>

        {/* 🧰 ACTIONS SECONDAIRES */}
        <div className="flex items-center gap-1" ref={containerRef}>

          {/* Création */}
          <button onClick={onNewMission} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Nouveau">
            <Plus size={16}/>
          </button>

          <button onClick={onDuplicate} disabled={!currentMissionId} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg disabled:opacity-20 transition-all" title="Dupliquer">
            <Copy size={16}/>
          </button>

          {/* Templates */}
          <Dropdown
            icon={<Sparkles size={14} className="text-purple-400" />}
            label="MODÈLES"
            isOpen={activeDropdown === 'templates'}
            onToggle={() => toggleDropdown('templates')}
          >
            <h4 className="px-2 py-1.5 mb-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Modèles disponibles</h4>
            {getTemplates().map((t: any) => (
              <button
                key={t.id}
                onClick={() => {
                  onTemplateSelect(t.id);
                  setActiveDropdown(null);
                }}
                className="w-full text-left p-2.5 text-[10px] font-bold text-slate-300 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <span className="group-hover:text-purple-400">{t.name}</span>
              </button>
            ))}
          </Dropdown>

          {/* Config */}
          <Dropdown
            icon={<Settings size={14} className="text-slate-400" />}
            label="CONFIG"
            isOpen={activeDropdown === 'config'}
            onToggle={() => toggleDropdown('config')}
          >
            <div className="p-1 space-y-1">
              <h4 className="px-2 py-1 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">Modules d'expertise</h4>
              
              {[
                { id: 'map', label: 'Carte SIG / GPS', icon: MapIcon, color: 'text-indigo-400' },
                { id: 'expenses', label: 'Frais & Indemnités', icon: DollarSign, color: 'text-emerald-400' },
                { id: 'inventory', label: 'Inventaire Matériel', icon: ListChecks, color: 'text-amber-400' },
              ].map((f) => {
                const isActive = !!formData.features?.[f.id];
                return (
                  <div
                    key={f.id}
                    onPointerDown={(e) => { e.stopPropagation(); onToggleFeature(f.id); }}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 pointer-events-none">
                      <f.icon size={14} className={`${f.color} ${isActive ? 'opacity-100' : 'opacity-40'} transition-opacity`} />
                      <span className={`text-[11px] font-bold ${isActive ? 'text-white' : 'text-slate-400'} transition-colors`}>{f.label}</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full relative transition-all duration-300 ${isActive ? 'bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-800'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-md transition-all duration-300 ${isActive ? 'left-4.5' : 'left-0.5'}`} />
                    </div>
                  </div>
                );
              })}

              <div className="h-px bg-white/5 my-1.5" />
              
              <div
                onPointerDown={(e) => { e.stopPropagation(); onToggleSimplifiedMode(!isSimplifiedMode); }}
                className="w-full flex items-center justify-between p-2.5 hover:bg-white/10 rounded-xl transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2.5 pointer-events-none">
                  <Smartphone size={14} className={`text-blue-400 ${isSimplifiedMode ? 'opacity-100' : 'opacity-40'} transition-opacity`} />
                  <span className={`text-[11px] font-bold ${isSimplifiedMode ? 'text-white' : 'text-slate-400'} transition-colors`}>Mode Terrain (Simplifié)</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-all duration-300 ${isSimplifiedMode ? 'bg-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-800'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-md transition-all duration-300 ${isSimplifiedMode ? 'left-4.5' : 'left-0.5'}`} />
                </div>
              </div>
            </div>
          </Dropdown>

          {/* Export */}
          <Dropdown
            icon={<Download size={14} className="text-blue-400" />}
            label="EXPORT"
            isOpen={activeDropdown === 'export'}
            onToggle={() => toggleDropdown('export')}
          >
            <button
              onClick={() => { onExportExcel(); setActiveDropdown(null); }}
              className="w-full flex items-center gap-2 p-2.5 text-[10px] font-bold text-slate-300 hover:bg-white/5 rounded-lg"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Excel
            </button>
            <button
              onClick={() => { onExportWord(); setActiveDropdown(null); }}
              className="w-full flex items-center gap-2 p-2.5 text-[10px] font-bold text-slate-300 hover:bg-white/5 rounded-lg"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Word
            </button>
            <button
              onClick={() => { onExportPDF(); setActiveDropdown(null); }}
              className="w-full flex items-center gap-2 p-2.5 text-[10px] font-bold text-slate-300 hover:bg-white/5 rounded-lg"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> PDF
            </button>
          </Dropdown>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Sync */}
          <button onClick={onSyncFromServer} className="p-2 text-slate-400 hover:text-white transition-all" title="Synchroniser">
            <RefreshCw size={16} className={isSyncingServer ? 'animate-spin text-blue-400' : ''}/>
          </button>

          {/* Notifications */}
          <button onClick={onNotificationsToggle} className="relative p-2 text-slate-400 hover:text-white transition-all" title="Notifications">
            <Bell size={16}/>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 border border-slate-900 rounded-full"/>
            )}
          </button>

          {/* Audit */}
          <button onClick={onAuditToggle} className={`p-2 transition-all ${showAudit ? 'text-indigo-400 bg-indigo-500/10 rounded-lg' : 'text-slate-400 hover:text-white'}`} title="Piste d'audit">
            <Fingerprint size={16}/>
          </button>

        </div>

      </div>
    </ActionBar>
  );
};
