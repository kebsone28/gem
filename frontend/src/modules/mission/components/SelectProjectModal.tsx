import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Affecter à un Projet</DialogTitle>
          <DialogDescription className="text-slate-400">
            Sélectionnez le projet auquel vous souhaitez affecter cette mission.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
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

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSelect}
            disabled={!selectedProject || isLoading || projectsLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
          >
            {isLoading ? 'Affectation...' : 'Affecter'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
