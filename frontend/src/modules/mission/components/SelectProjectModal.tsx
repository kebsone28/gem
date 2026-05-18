import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import logger from '@/utils/logger';

interface SelectProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (projectId: string) => void;
  isLoading?: boolean;
}

export const SelectProjectModal: React.FC<SelectProjectModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  isLoading = false,
}) => {
  const { projects, isLoading: projectsLoading } = useProjects();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedProject(null);
    }
  }, [isOpen]);

  const handleSelect = () => {
    if (selectedProject) {
      logger.debug('🎯 Assigning mission to project:', selectedProject);
      onSelect(selectedProject);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-lg w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">Affecter à un Projet</h2>
            <p className="text-sm text-slate-400 mt-1">Sélectionnez le projet auquel vous souhaitez affecter cette mission.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {projectsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
              <p className="text-slate-400 mt-2">Chargement des projets...</p>
            </div>
          ) : projects && projects.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {projects.map((project: any) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                    selectedProject === project.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-medium">{project.name || 'Sans nom'}</div>
                  {project.description && (
                    <div className="text-sm text-slate-400">{project.description}</div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400">Aucun projet disponible</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedProject || isLoading || projectsLoading}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Affectation...' : 'Affecter'}
          </button>
        </div>
      </div>
    </div>
  );
};
