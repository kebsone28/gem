import React from 'react';
import {
  Plus,
  Copy,
  Sparkles,
  ChevronDown,
  Settings,
  Smartphone,
  DollarSign,
  RefreshCw,
  Archive,
  Trash2,
  Save,
  ListChecks,
  MapIcon,
  Fingerprint,
  Bell,
} from 'lucide-react';
import { ActionBar } from '../../../components';
import { getTemplates } from '../../../services/missionTemplates';

interface MissionOrderActionBarProps {
  formData: any;
  currentMissionId: string | null;
  role: string | null;
  isSyncing: boolean;
  isSyncingServer: boolean;
  isDirty: boolean;
  showTemplates: boolean;
  showConfig: boolean;
  showAudit: boolean;
  PERMISSIONS: any;
  peut: (perm: string) => boolean;

  onNewMission: () => void;
  onDuplicate: () => void;
  onTemplateToggle: () => void;
  onTemplateSelect: (id: string) => void;
  onConfigToggle: () => void;
  onToggleFeature: (feature: string) => void;
  onToggleSimplifiedMode: (value: boolean) => void;
  onNotificationsToggle: () => void;
  onAuditToggle: () => void;
  unreadCount?: number;
  onSyncFromServer: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onExportExcel: () => void;
  onExportWord: () => void;
  onExportPDF: () => void;
  onSave: () => void;
  onValidate: () => void;
  onSubmit: () => void;
  isCertified: boolean;
  isSubmitted: boolean;
}

export const MissionOrderActionBar: React.FC<MissionOrderActionBarProps> = ({
  formData,
  currentMissionId,
  role,
  isSyncing,
  isSyncingServer,
  isDirty,
  showTemplates,
  showConfig,
  showAudit,
  PERMISSIONS,
  peut,

  onNewMission,
  onDuplicate,
  onTemplateToggle,
  onTemplateSelect,
  onConfigToggle,
  onToggleFeature,
  onToggleSimplifiedMode,
  onNotificationsToggle,
  onAuditToggle,
  unreadCount = 0,
  onSyncFromServer,
  onArchive,
  onDelete,
  onExportExcel,
  onExportWord,
  onExportPDF,
  onSave,
  onValidate,
  onSubmit,
  isCertified,
  isSubmitted,
}) => {
  const isAdmin = ['ADMIN', 'ADMIN_PROQUELEC', 'DG_PROQUELEC'].includes(role || '');

  return (
    <ActionBar className="no-print">
      <div className="flex items-center gap-3 flex-wrap flex-1">
        <button
          onClick={onNewMission}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:from-indigo-500 hover:to-blue-500 transition-all shadow-lg active:scale-95 border border-white/10"
        >
          <Plus size={12} />
          NOUVEAU
        </button>

        <button
          onClick={onDuplicate}
          disabled={!currentMissionId}
          className="flex items-center gap-2 px-4 py-2.5 border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-amber-500/20 transition-all shadow-sm disabled:opacity-50"
        >
          <Copy size={12} />
          DUPLIQUER
        </button>

        <div className="relative">
          <button
            onClick={onTemplateToggle}
            className="flex items-center gap-2 px-4 py-2.5 border border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-purple-500/20 transition-all shadow-sm"
          >
            <Sparkles size={12} />
            MODELES
            <ChevronDown
              size={12}
              className={`transition-transform duration-300 ${showTemplates ? 'rotate-180' : ''}`}
            />
          </button>

          {showTemplates && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] p-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-1">
                {getTemplates().map((template: any) => (
                  <button
                    key={template.id}
                    onClick={() => onTemplateSelect(template.id)}
                    className="w-full p-3 text-left rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                  >
                    <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest group-hover:text-indigo-500 transition-colors">
                      {template.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={onConfigToggle}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-500/30 text-slate-600 dark:text-slate-400 bg-slate-500/10 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-500/20 transition-all shadow-sm"
          >
            <Settings size={12} />
            CONFIG
            <ChevronDown
              size={12}
              className={`transition-transform duration-300 ${showConfig ? 'rotate-180' : ''}`}
            />
          </button>

          {showConfig && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Modules Experts
              </h4>
              <div className="space-y-3">
                {[
                  { id: 'map', label: 'Mini-Carte SIG', icon: MapIcon, color: 'text-indigo-500' },
                  {
                    id: 'expenses',
                    label: 'Gestion des Frais',
                    icon: DollarSign,
                    color: 'text-emerald-500',
                  },
                  {
                    id: 'inventory',
                    label: 'Inventaire & Checklist',
                    icon: ListChecks,
                    color: 'text-amber-500',
                  },
                  { id: 'ai', label: 'Outils IA', icon: Sparkles, color: 'text-purple-500' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onToggleFeature(f.id)}
                    className="w-full flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <f.icon size={14} className={f.color} />
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {f.label}
                      </span>
                    </div>
                    <div
                      className={`w-8 h-4 rounded-full relative transition-colors ${formData.features?.[f.id] ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <div
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${formData.features?.[f.id] ? 'left-4.5' : 'left-0.5'}`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-1 hidden lg:block" />

        <button
          onClick={onAuditToggle}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-sm ${showAudit ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20'}`}
        >
          <Fingerprint size={12} />
          AUDIT
        </button>

        <button
          onClick={onNotificationsToggle}
          className="relative flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-amber-500/20 transition-all shadow-sm"
        >
          <Bell size={12} className={unreadCount > 0 ? 'animate-bounce' : ''} />
          ALERTE
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-lg animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={onSyncFromServer}
          disabled={isSyncingServer}
          className="flex items-center gap-2 px-4 py-2.5 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-500/20 transition-all shadow-sm"
        >
          <RefreshCw size={12} className={isSyncingServer ? 'animate-spin' : ''} />
          SYNC
        </button>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={onArchive}
              className="p-3 border border-slate-400 dark:border-white/20 text-slate-600 dark:text-slate-400 bg-slate-500/10 rounded-xl hover:bg-slate-500/20 transition-all shadow-sm"
              title="ARCHIVER"
            >
              <Archive size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-3 border border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 rounded-xl hover:bg-rose-500/20 transition-all shadow-sm"
              title="SUPPRIMER"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex items-center gap-1.5">
          {/* Export Excel */}
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm group"
            title="Exporter en Excel (.xlsx)"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="currentColor">
              <path
                d="M14.017 1.002H4.5A1.5 1.5 0 0 0 3 2.502v19a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V8.017l-7-7z"
                opacity="0.3"
              />
              <path d="M14 1v6a1 1 0 0 0 1 1h6" />
              <path
                d="m7 13 2.5 4 2.5-4m0 0 2.5 4 2.5-4"
                strokeWidth="1.5"
                stroke="currentColor"
                fill="none"
              />
            </svg>
            <span className="text-[8px] font-black uppercase tracking-widest">XLS</span>
          </button>

          {/* Export Word */}
          <button
            onClick={onExportWord}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm group"
            title="Exporter en Word (.docx)"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="currentColor">
              <path
                d="M14.017 1.002H4.5A1.5 1.5 0 0 0 3 2.502v19a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V8.017l-7-7z"
                opacity="0.3"
              />
              <path d="M14 1v6a1 1 0 0 0 1 1h6" />
              <text x="6" y="19" fontSize="7" fontWeight="bold" fill="currentColor">
                W
              </text>
            </svg>
            <span className="text-[8px] font-black uppercase tracking-widest">WORD</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={onExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-sm group"
            title="Exporter en PDF (.pdf)"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="currentColor">
              <path
                d="M14.017 1.002H4.5A1.5 1.5 0 0 0 3 2.502v19a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V8.017l-7-7z"
                opacity="0.3"
              />
              <path d="M14 1v6a1 1 0 0 0 1 1h6" />
              <text x="5" y="19" fontSize="6" fontWeight="bold" fill="currentColor">
                PDF
              </text>
            </svg>
            <span className="text-[8px] font-black uppercase tracking-widest">PDF</span>
          </button>
        </div>

        {isAdmin && !isCertified && (
          <button
            onClick={onValidate}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-xl hover:scale-105 transition-all text-[9px] uppercase tracking-widest ml-2 border border-white/10"
          >
            <ListChecks size={12} />
            VALIDER LA MISSION
          </button>
        )}

        {isCertified && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-[9px] uppercase tracking-widest ml-2">
            <Fingerprint size={12} />
            MISSION VALIDÉE
          </div>
        )}

        {peut(PERMISSIONS.CREER_MISSION) && !isCertified && (
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => onToggleSimplifiedMode(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-black shadow-xl hover:scale-105 transition-all text-[9px] uppercase tracking-widest border border-white/10"
              title="Lancer l'interface terrain"
            >
              <Smartphone size={12} />
              MODE TERRAIN
            </button>

            {isSubmitted ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-xl font-black text-[9px] uppercase tracking-widest">
                <RefreshCw size={12} className="animate-spin" />
                EN ATTENTE
              </div>
            ) : (
              !isAdmin && (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        'Voulez-vous soumettre cette mission pour validation ? Elle ne sera plus modifiable.'
                      )
                    ) {
                      onSubmit();
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/20 text-indigo-500 border border-indigo-500/30 rounded-xl font-black shadow-xl hover:scale-105 transition-all text-[9px] uppercase tracking-widest"
                >
                  <ListChecks size={12} />
                  SOUMETTRE
                </button>
              )
            )}

            <button
              onClick={onSave}
              disabled={isSyncing || isSyncingServer || isSubmitted || isCertified}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black shadow-xl hover:scale-105 transition-all text-[9px] uppercase tracking-widest ${isSubmitted || isCertified ? 'bg-slate-500/20 text-slate-500 cursor-not-allowed border-white/5' : isDirty ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              <Save size={12} className={isSyncing || isSyncingServer ? 'animate-pulse' : ''} />
              {isSubmitted || isCertified
                ? 'LOCKED'
                : isSyncing || isSyncingServer
                  ? 'SYNC...'
                  : isDirty
                    ? 'ENREGISTRER*'
                    : 'SAUVEGARDÉ'}
            </button>
          </div>
        )}
      </div>
    </ActionBar>
  );
};
