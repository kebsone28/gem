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
  Loader2,
  CheckCheck,
  FileText,
  FileSpreadsheet,
  FileDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionBar } from '../../../../../components';
import { getTemplates } from '../../../../../services/missionTemplates';

/* ─── Dropdown helper ───────────────────────────────────────────────────── */
const Dropdown = ({ icon, label, isOpen, onToggle, children }: any) => (
  <div className="relative">
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border ${
        isOpen
          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
          : 'text-slate-400 hover:text-white border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <ChevronDown
        size={10}
        className={`opacity-50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      />
    </motion.button>

    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full right-0 mt-2 w-[min(17rem,calc(100vw-1.5rem))] bg-[#0f1117]/98 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-2 z-50"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/* ─── Toggle Row ─────────────────────────────────────────────────────────── */
const ToggleRow = ({ icon: Icon, label, color, active, onToggle }: any) => (
  <div
    onPointerDown={(e) => { e.stopPropagation(); onToggle(); }}
    className="flex items-center justify-between px-3 py-2.5 hover:bg-white/5 rounded-xl cursor-pointer group transition-all"
  >
    <div className="flex items-center gap-2.5 pointer-events-none">
      <Icon size={13} className={`${color} ${active ? 'opacity-100' : 'opacity-30'} transition-opacity`} />
      <span className={`text-[11px] font-semibold ${active ? 'text-white' : 'text-slate-500'} transition-colors`}>{label}</span>
    </div>
    <div className={`w-8 h-4.5 h-[18px] rounded-full relative transition-all duration-250 pointer-events-none ${active ? 'bg-indigo-500 shadow-md shadow-indigo-500/30' : 'bg-slate-800'}`}>
      <div className={`absolute top-[3px] w-3 h-3 rounded-full bg-white shadow transition-all duration-250 ${active ? 'left-[18px]' : 'left-[3px]'}`} />
    </div>
  </div>
);

/* ─── Main component ─────────────────────────────────────────────────────── */
export const MissionOrderActionBar = (props: any) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setActiveDropdown(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const toggle = (name: string) => setActiveDropdown(activeDropdown === name ? null : name);

  const {
    formData, currentMissionId, role,
    isSyncing, isSyncingServer, isDirty, syncStatus,
    showAudit, unreadCount = 0,
    onNewMission, onDuplicate, onTemplateSelect, onConfigToggle,
    onToggleFeature, onToggleSimplifiedMode, onNotificationsToggle,
    onAuditToggle, onSyncFromServer, onUpdateField,
    onExportExcel, onExportWord, onExportPDF,
    onSave, onValidate, onSubmit,
    isCertified, isSubmitted, isSimplifiedMode,
  } = props;

  const normalizedRole = (role || '').toUpperCase();
  const isValidator = [
    'ADMIN', 'ADMIN_PROQUELEC', 'DIRECTEUR', 'DIRECTEUR_GENERAL',
    'DIRECTEUR_TECHNIQUE', 'DG_PROQUELEC', 'DIR_GEN',
  ].includes(normalizedRole);

  /* ── Status badge config ── */
  const statusBadge = isCertified
    ? { label: 'OFFICIELLE', bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', dot: 'bg-emerald-400', pulse: true }
    : isSubmitted
    ? { label: 'EN ATTENTE', bg: 'bg-blue-500/15 border-blue-500/30 text-blue-400', dot: 'bg-blue-400', pulse: false }
    : { label: 'BROUILLON', bg: 'bg-slate-700/60 border-white/8 text-slate-400', dot: isDirty ? 'bg-amber-400' : 'bg-slate-500', pulse: false };

  /* ── Save button config ── */
  const saveState = (() => {
    if (isSubmitted || isCertified) return { label: 'ARCHIVÉ', cls: 'bg-slate-800/60 text-slate-600 cursor-default', icon: CheckCheck, disabled: true };
    if (isSyncing || isSyncingServer) return { label: 'ENVOI…', cls: 'bg-indigo-600/50 text-indigo-300', icon: Loader2, disabled: true };
    if (isDirty) return { label: 'ENREGISTRER', cls: 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-lg shadow-amber-500/25', icon: Save, disabled: false };
    if (syncStatus === 'failed') return { label: 'ERREUR SYNC', cls: 'bg-gradient-to-r from-rose-700 to-rose-600 text-white shadow-lg shadow-rose-500/25', icon: Save, disabled: false };
    return { label: 'À JOUR', cls: 'bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-lg shadow-indigo-500/25', icon: Save, disabled: false };
  })();

  return (
    <ActionBar className="no-print !bg-[#080b12]/90 backdrop-blur-3xl border-b border-white/[0.06] px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      <div className="flex w-full items-center gap-3 min-w-0">

        {/* ── IDENTITY: title + status ── */}
        <div className="flex flex-col min-w-0 flex-1 max-w-[260px] xl:max-w-[340px]">
          {!isCertified && !isSubmitted ? (
            <input
              type="text"
              value={formData.purpose || ''}
              onChange={(e) => onUpdateField?.('purpose', e.target.value.toUpperCase())}
              placeholder="OBJET DE LA MISSION…"
              className="bg-transparent border-none outline-none text-[12px] font-black text-white/90 placeholder:text-slate-600 w-full focus:ring-0 p-0 tracking-tight truncate"
            />
          ) : (
            <span className="text-[12px] font-black text-white/90 truncate tracking-tight">
              {formData.purpose || 'Mission Sans Titre'}
            </span>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black border ${statusBadge.bg}`}>
              <motion.div
                animate={statusBadge.pulse ? { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`}
              />
              {statusBadge.label}
            </div>
            {formData.region && (
              <span className="text-[9px] text-slate-600 font-bold truncate hidden md:block">{formData.region}</span>
            )}
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div className="h-8 w-px bg-white/[0.06] hidden sm:block shrink-0" />

        {/* ── PRIMARY ACTIONS ── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Save / Status */}
          <motion.button
            whileHover={!saveState.disabled ? { scale: 1.03, y: -1 } : {}}
            whileTap={!saveState.disabled ? { scale: 0.97 } : {}}
            onClick={!saveState.disabled ? onSave : undefined}
            disabled={saveState.disabled}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${saveState.cls} disabled:cursor-default`}
          >
            {(isSyncing || isSyncingServer)
              ? <Loader2 size={14} className="animate-spin" />
              : <saveState.icon size={14} />
            }
            <span className="hidden sm:inline">{saveState.label}</span>
          </motion.button>

          {/* Submit */}
          {!isSubmitted && !isCertified && (
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => window.confirm('Soumettre la mission pour validation ?') && onSubmit()}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-[10px] font-black tracking-widest shadow-lg shadow-indigo-600/30 transition-all border-t border-white/15"
            >
              <ListChecks size={14} />
              <span className="hidden sm:inline">SOUMETTRE</span>
            </motion.button>
          )}

          {/* Validate (admin only, after submission) */}
          {isValidator && isSubmitted && !isCertified && (
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={onValidate}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-xl text-[10px] font-black tracking-widest shadow-lg shadow-emerald-500/30 transition-all border-t border-white/15"
            >
              <Fingerprint size={14} />
              <span className="hidden sm:inline">VALIDER</span>
            </motion.button>
          )}
        </div>

        {/* ── DIVIDER ── */}
        <div className="h-8 w-px bg-white/[0.06] hidden lg:block shrink-0" />

        {/* ── SECONDARY TOOLS ── */}
        <div className="flex items-center gap-0.5 ml-auto" ref={containerRef}>

          {/* Quick actions: new / duplicate */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-white/[0.06] mr-1">
            <button
              onClick={onNewMission}
              title="Nouvelle mission"
              className="p-2 text-slate-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={onDuplicate}
              disabled={!currentMissionId}
              title="Dupliquer"
              className="p-2 text-slate-500 hover:text-white hover:bg-white/[0.06] rounded-lg disabled:opacity-20 transition-all"
            >
              <Copy size={15} />
            </button>
          </div>

          {/* Modèles */}
          <Dropdown
            icon={<Sparkles size={13} className="text-purple-400" />}
            label="MODÈLES"
            isOpen={activeDropdown === 'templates'}
            onToggle={() => toggle('templates')}
          >
            <p className="px-3 py-2 text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5 mb-1">Modèles disponibles</p>
            {getTemplates().map((t: any) => (
              <button
                key={t.id}
                onClick={() => { onTemplateSelect(t.id); setActiveDropdown(null); }}
                className="w-full text-left px-3 py-2.5 text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                {t.name}
              </button>
            ))}
          </Dropdown>

          {/* Config */}
          <Dropdown
            icon={<Settings size={13} className="text-slate-400" />}
            label="CONFIG"
            isOpen={activeDropdown === 'config'}
            onToggle={() => toggle('config')}
          >
            <p className="px-3 py-2 text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5 mb-1">Modules d'expertise</p>
            <ToggleRow icon={MapIcon}     label="Carte SIG / GPS"       color="text-indigo-400" active={!!formData.features?.map}      onToggle={() => onToggleFeature('map')} />
            <ToggleRow icon={DollarSign}  label="Frais & Indemnités"    color="text-emerald-400" active={!!formData.features?.expenses} onToggle={() => onToggleFeature('expenses')} />
            <ToggleRow icon={ListChecks}  label="Inventaire Matériel"   color="text-amber-400"  active={!!formData.features?.inventory} onToggle={() => onToggleFeature('inventory')} />
            <div className="my-1.5 border-t border-white/5" />
            <ToggleRow icon={Smartphone}  label="Mode Terrain (Simplifié)" color="text-blue-400" active={!!isSimplifiedMode}           onToggle={() => onToggleSimplifiedMode(!isSimplifiedMode)} />
          </Dropdown>

          {/* Export */}
          <Dropdown
            icon={<Download size={13} className="text-sky-400" />}
            label="EXPORT"
            isOpen={activeDropdown === 'export'}
            onToggle={() => toggle('export')}
          >
            <p className="px-3 py-2 text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5 mb-1">Exporter en</p>
            {[
              { label: 'Excel (.xlsx)', dot: 'bg-emerald-500', icon: FileSpreadsheet, fn: onExportExcel },
              { label: 'Word (.docx)',  dot: 'bg-blue-500',    icon: FileText,        fn: onExportWord  },
              { label: 'PDF',          dot: 'bg-rose-500',     icon: FileDown,        fn: onExportPDF   },
            ].map(({ label, dot, icon: Icon, fn }) => (
              <button
                key={label}
                onClick={() => { fn(); setActiveDropdown(null); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <Icon size={12} className="opacity-50" />
                {label}
              </button>
            ))}
          </Dropdown>

          {/* ── Utility icons ── */}
          <div className="flex items-center gap-0.5 pl-2 border-l border-white/[0.06] ml-1">
            <button
              onClick={onSyncFromServer}
              title="Synchroniser"
              className="p-2 text-slate-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <RefreshCw size={15} className={isSyncingServer ? 'animate-spin text-indigo-400' : ''} />
            </button>

            <button
              onClick={onNotificationsToggle}
              title="Notifications"
              className="relative p-2 text-slate-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-[#080b12]" />
              )}
            </button>

            <button
              onClick={onAuditToggle}
              title="Piste d'audit"
              className={`p-2 rounded-lg transition-all ${showAudit ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-white hover:bg-white/[0.06]'}`}
            >
              <Fingerprint size={15} />
            </button>
          </div>
        </div>
      </div>
    </ActionBar>
  );
};
