/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React from 'react';
import type { RefObject } from 'react';

interface ProjectModalsProps {
  showCreate: boolean;
  showDelete: boolean;
  newProjectName: string;
  onNewProjectNameChange: (value: string) => void;
  deletePassword: string;
  onDeletePasswordChange: (value: string) => void;
  deleteError: string;
  onCreateConfirm: () => void;
  onDeleteConfirm: () => void;
  onCloseCreate: () => void;
  onCloseDelete: () => void;
  modalInputRef: RefObject<HTMLInputElement | null>;
}

const ProjectModals: React.FC<ProjectModalsProps> = ({
  showCreate,
  showDelete,
  newProjectName,
  onNewProjectNameChange,
  deletePassword,
  onDeletePasswordChange,
  deleteError,
  onCreateConfirm,
  onDeleteConfirm,
  onCloseCreate,
  onCloseDelete,
  modalInputRef,
}) => {
  return (
    <>
      {/* Create Project Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onCloseCreate}
        >
          <div
            className="w-full max-w-md rounded-3xl shadow-2xl border border-white/5 p-8 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-black text-white italic">Nouveau Projet</h2>
            <p className="text-[11px] font-black uppercase tracking-widest mt-2 text-blue-300/30 font-bold">
              Créez un nouvel espace de travail.
            </p>
            <input
              ref={modalInputRef}
              type="text"
              value={newProjectName}
              onChange={(e) => onNewProjectNameChange(e.target.value)}
              className="w-full px-5 py-4 mt-6 rounded-2xl border border-white/5 bg-black/40 text-white outline-none font-black text-xs uppercase tracking-widest focus:border-primary transition-all underline-none"
              placeholder="Nom du projet"
            />
            <div className="flex gap-4 mt-8">
              <button
                onClick={onCloseCreate}
                className="flex-1 py-4 rounded-2xl border border-white/5 font-black text-xs uppercase tracking-widest text-white hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={onCreateConfirm}
                disabled={!newProjectName.trim()}
                className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest transition-all"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDelete && (
        <div
          className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onCloseDelete}
        >
          <div
            className="w-full max-w-md rounded-3xl shadow-2xl border border-white/5 p-8 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-black text-white italic">Supprimer Projet</h2>
            <p className="text-[11px] font-black uppercase tracking-widest mt-2 text-rose-500 font-bold">
              Veuillez confirmer votre identité administrateur.
            </p>
            <input
              ref={modalInputRef}
              type="password"
              value={deletePassword}
              onChange={(e) => onDeletePasswordChange(e.target.value)}
              className="w-full px-5 py-4 mt-6 rounded-2xl border border-white/5 bg-black/40 text-white outline-none font-black text-xs uppercase tracking-widest focus:border-rose-500 transition-all underline-none"
              placeholder="Mot de passe admin"
            />
            {deleteError && (
              <p className="text-rose-500 text-[10px] mt-2 font-black uppercase tracking-widest">
                {deleteError}
              </p>
            )}
            <div className="flex gap-4 mt-8">
              <button
                onClick={onCloseDelete}
                className="flex-1 py-4 rounded-2xl border border-white/5 font-black text-xs uppercase tracking-widest text-white hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={onDeleteConfirm}
                disabled={!deletePassword}
                className="flex-1 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-widest transition-all"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(ProjectModals);
