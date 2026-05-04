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
  DollarSign,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionBar } from '../../../components';
import { getTemplates } from '../../../services/missionTemplates';

const Dropdown = ({ icon, label, isOpen, onToggle, children }: any) => {
  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.08)" }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
        className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-[0.15em] border ${
          isOpen 
            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
            : 'text-slate-300 hover:text-white border-white/10 bg-white/[0.02]'
        }`}
      >
        <span className="relative flex items-center gap-2">
          {icon}
          {label && <span className="hidden sm:inline">{label}</span>}
        </span>
        <ChevronDown size={12} className={`transition-transform duration-300 opacity-50 ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-full right-0 mt-3 w-[min(18rem,calc(100vw-2rem))] bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 z-50 origin-top-right"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
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
    syncStatus,
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

  const normalizedRole = (role || '').toUpperCase();
  const isValidator = [
    'ADMIN',
    'ADMIN_PROQUELEC',
    'DIRECTEUR',
    'DIRECTEUR_GENERAL',
    'DIRECTEUR_TECHNIQUE',
    'DG_PROQUELEC',
    'DIR_GEN',
  ].includes(normalizedRole);

  const saveLabel = (() => {
    if (isSubmitted || isCertified) return 'ARCHIVÉ';
    if (isSyncing || isSyncingServer) return 'ENVOI...';
    if (isDirty) return 'ENREGISTRER';
    if (syncStatus === 'pending') return 'SYNCHRONISER';
    if (syncStatus === 'failed') return 'ERREUR SYNC';
    return 'À JOUR';
  })();

  return (
    <ActionBar className="no-print !bg-slate-950/80 backdrop-blur-2xl border-t border-white/10 px-3 py-3 sm:px-4 sm:py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">

      <div className="flex w-full flex-col gap-4">

        {/* 📝 TITRE & INFOS */}
        <div className="flex flex-col min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {!isCertified && !isSubmitted ? (
               <input
                 type="text"
                 value={formData.purpose || ''}
                 onChange={(e) => onUpdateField('purpose', e.target.value.toUpperCase())}
                 placeholder="OBJET DE LA MISSION..."
                 className="bg-transparent border-none outline-none text-[11px] sm:text-[10px] font-black text-white/90 placeholder:text-slate-600 w-full sm:max-w-[320px] focus:ring-0 p-0 tracking-tight"
               />
            ) : (
              <h4 className="text-[11px] sm:text-[10px] font-black text-white/90 truncate uppercase tracking-tight sm:max-w-[320px]">
                {formData.purpose || 'Mission Sans Titre'}
              </h4>
            )}
            <div className={`px-2.5 py-1 rounded-full text-[9px] font-black flex items-center gap-1.5 shadow-sm ${
              isCertified ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
              isSubmitted ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              'bg-slate-500/20 text-slate-300 border border-white/10'
            }`}>
              <motion.div 
                animate={isCertified ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                className={`w-1.5 h-1.5 rounded-full ${
                  isCertified ? 'bg-emerald-400' : 
                  isSubmitted ? 'bg-blue-400' : 
                  'bg-slate-400'
                }`} 
              />
              {isCertified ? 'SIGNÉE' : isSubmitted ? 'ATTENTE' : 'BROUILLON'}
            </div>
          </div>
          <span className="text-[10px] sm:text-[9px] text-slate-500 font-bold truncate mt-1 tracking-wide">
            {formData.orderNumber && !formData.orderNumber.startsWith('TEMP-') ? `${formData.orderNumber} • ` : ''}
            {formData.date || 'Date non définie'} • {formData.region || 'Localisation à préciser'}
          </span>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* ⚡ ACTIONS PRINCIPALES */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSave}
              disabled={isSyncing || isSyncingServer || isSubmitted || isCertified}
              className={`flex min-h-12 items-center justify-center gap-2.5 px-5 py-2.5 rounded-2xl text-[11px] font-black tracking-widest transition-all shadow-xl ${
                isSubmitted || isCertified
                  ? 'bg-slate-800 text-slate-600'
                  : isDirty
                  ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-orange-500/20 border-t border-white/20'
                  : 'bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-blue-500/20 border-t border-white/20'
              }`}
            >
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saveLabel}
            </motion.button>

            {!isSubmitted && !isCertified && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1, boxShadow: "0 10px 25px rgba(99, 102, 241, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.confirm('Soumettre la mission ?') && onSubmit()}
                className="flex min-h-12 items-center justify-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl text-[11px] font-black tracking-widest shadow-xl shadow-indigo-600/30 border-t border-white/20 transition-all"
              >
                <ListChecks size={16}/> SOUMETTRE
              </motion.button>
            )}

            {isValidator && isSubmitted && !isCertified && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1, boxShadow: "0 10px 25px rgba(16, 185, 129, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={onValidate}
                className="flex min-h-12 items-center justify-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-2xl text-[11px] font-black tracking-widest shadow-xl shadow-emerald-600/30 border-t border-white/20 transition-all"
              >
                <Fingerprint size={16}/> VALIDER
              </motion.button>
            )}

          </div>

          {/* 🧰 ACTIONS SECONDAIRES */}
          {/* 🧰 TOOLS & UTILITIES */}
          <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-2xl border border-white/5" ref={containerRef}>
            
            <div className="flex items-center pr-1 border-r border-white/5">
              <button onClick={onNewMission} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Nouveau">
                <Plus size={16}/>
              </button>
              <button onClick={onDuplicate} disabled={!currentMissionId} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl disabled:opacity-20 transition-all" title="Dupliquer">
                <Copy size={16}/>
              </button>
            </div>

            <div className="flex items-center gap-0.5 px-1">
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
            </div>

            <div className="flex items-center pl-1 border-l border-white/5">
              {/* Sync */}
              <button onClick={onSyncFromServer} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Synchroniser">
                <RefreshCw size={16} className={isSyncingServer ? 'animate-spin text-blue-400' : ''}/>
              </button>

              {/* Notifications */}
              <button onClick={onNotificationsToggle} className="relative p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Notifications">
                <Bell size={16}/>
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 border border-slate-900 rounded-full"/>
                )}
              </button>

              {/* Audit */}
              <button onClick={onAuditToggle} className={`p-2.5 transition-all rounded-xl ${showAudit ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Piste d'audit">
                <Fingerprint size={16}/>
              </button>
            </div>

          </div>
        </div>
      </div>
    </ActionBar>
  );
};
