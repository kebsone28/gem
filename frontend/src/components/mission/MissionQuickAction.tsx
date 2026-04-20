/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React, { useState } from 'react';
import { Copy, Sparkles, Download, Upload, ChevronRight, Trash2, Archive } from 'lucide-react';
import {
  getTemplates,
  createMissionFromTemplate,
  exportMissionAsJSON,
  importMissionFromJSON,
} from '../../services/missionTemplates';
import type { MissionOrderData, MissionMember } from '../../pages/mission/core/missionTypes';

interface MissionQuickActionProps {
  currentData: Partial<MissionOrderData>;
  currentMembers: MissionMember[];
  onLoadTemplate: (data: Partial<MissionOrderData>, members: MissionMember[]) => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  isAdmin?: boolean;
}

export const MissionQuickAction: React.FC<MissionQuickActionProps> = ({
  currentData,
  currentMembers,
  onLoadTemplate,
  onDuplicate,
  onDelete,
  onArchive,
  isAdmin = false,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const templates = getTemplates();

  const handleTemplateSelect = (templateId: string) => {
    try {
      const { formData, members } = createMissionFromTemplate(templateId as any);
      onLoadTemplate(formData, members);
      setShowTemplates(false);
    } catch (err) {
      console.error('Template error:', err);
    }
  };

  const handleDuplicate = () => {
    onDuplicate();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data, members } = await importMissionFromJSON(file);
      onLoadTemplate(data, members);
    } catch (err) {
      alert('Erreur importation: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {/* Dupliquer */}
        <button
          onClick={handleDuplicate}
          disabled={!currentData.orderNumber}
          className="flex items-center gap-2 p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl hover:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
        >
          <div className="p-2 bg-amber-500/20 rounded-lg group-hover:scale-110 transition-transform">
            <Copy size={18} className="text-amber-600 dark:text-amber-500" />
          </div>
          <div className="text-left flex-1">
            <p className="text-xs font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest">
              Dupliquer
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-600 font-bold">Nouvelle mission</p>
          </div>
          <ChevronRight
            size={14}
            className="text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </button>

        {/* Templates */}
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="flex items-center gap-2 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl hover:border-indigo-400 transition-all group"
        >
          <div className="p-2 bg-indigo-500/20 rounded-lg group-hover:scale-110 transition-transform">
            <Sparkles size={18} className="text-indigo-600 dark:text-indigo-500" />
          </div>
          <div className="text-left flex-1">
            <p className="text-xs font-black text-indigo-700 dark:text-indigo-500 uppercase tracking-widest">
              Template
            </p>
            <p className="text-xs text-indigo-600 dark:text-indigo-600 font-bold">
              Démarrer rapide
            </p>
          </div>
          <ChevronRight
            size={14}
            className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </button>
      </div>

      {/* Global Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => exportMissionAsJSON(currentData, currentMembers)}
          className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-white/5 text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
        >
          <Download size={12} />
          JSON
        </button>

        {onArchive && (
          <button
            onClick={onArchive}
            className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-500 rounded-xl border border-slate-200 dark:border-white/5 text-xs font-black uppercase tracking-widest hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5"
            title="Archiver la mission"
          >
            <Archive size={12} />
            Archiver
          </button>
        )}

        {isAdmin && onDelete && (
          <button
            onClick={onDelete}
            className="flex-1 py-2.5 px-3 bg-rose-500/10 text-rose-600 dark:text-rose-500 rounded-xl border border-rose-500/20 text-xs font-black uppercase tracking-widest hover:bg-rose-500/20 transition-colors flex items-center justify-center gap-1.5"
            title="Supprimer définitivement"
          >
            <Trash2 size={12} />
            Supprimer
          </button>
        )}
      </div>

      <div className="flex bg-slate-50 dark:bg-slate-900/40 p-2 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
        <label className="flex-1 py-2 bg-transparent text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] hover:text-indigo-500 transition-colors flex items-center justify-center gap-2 cursor-pointer">
          <Upload size={14} />
          Importer un fichier JSON
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>

      {/* Templates Grid */}
      {showTemplates && (
        <div className="space-y-2 p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl border border-slate-200 dark:border-white/5">
          <h4 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] mb-3">
            Modèles Disponibles
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {templates.map((template: any) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className="p-3 text-left rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="text-xs font-black text-slate-800 dark:text-white group-hover:text-indigo-600">
                      {template.name}
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {template.description}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-slate-400 group-hover:text-indigo-600 transition-colors flex-shrink-0 mt-0.5"
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
