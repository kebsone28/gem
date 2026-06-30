import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Check, X as XIcon } from 'lucide-react';
import mesAPI, { type MESRecord } from '@services/mesAPI';
import toast from 'react-hot-toast';

interface MESControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MESRecord | null;
  onSuccess: () => void;
}

const MESControlModal: React.FC<MESControlModalProps> = ({ isOpen, onClose, record, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState({
    compteurFixe: false,
    coupeCircuit: false,
    raccordement: false,
    conformiteZone: false,
    photosValides: false,
  });
  const [observations, setObservations] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;

    setLoading(true);

    try {
      await mesAPI.controlRecord(record.id, record.id, checklist);
      toast.success('Contrôle qualité enregistré avec succès');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement du contrôle qualité');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistChange = (key: string, value: boolean) => {
    setChecklist(prev => ({ ...prev, [key]: value }));
  };

  const allChecked = Object.values(checklist).every(v => v === true);

  if (!isOpen || !record) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <ShieldCheck className="text-cyan-400" size={20} />
              </div>
              <h2 className="text-xl font-bold text-white">Contrôle Qualité</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="text-slate-400" size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Informations de l'enregistrement */}
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Avis:</span>
                <span className="text-sm text-white font-medium">{record.avisNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Compteur:</span>
                <span className="text-sm text-white font-medium">{record.meterNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Zone:</span>
                <span className="text-sm text-white font-medium">{record.zone}</span>
              </div>
            </div>

            {/* Checklist de contrôle */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Checklist de contrôle</h3>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.compteurFixe}
                    onChange={e => handleChecklistChange('compteurFixe', e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-sm text-white font-medium">Compteur fixe</span>
                    <p className="text-xs text-slate-400">Le compteur est correctement fixé</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.coupeCircuit}
                    onChange={e => handleChecklistChange('coupeCircuit', e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-sm text-white font-medium">Coupe-circuit</span>
                    <p className="text-xs text-slate-400">Le coupe-circuit est installé</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.raccordement}
                    onChange={e => handleChecklistChange('raccordement', e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-sm text-white font-medium">Raccordement</span>
                    <p className="text-xs text-slate-400">Les raccordements sont conformes</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.conformiteZone}
                    onChange={e => handleChecklistChange('conformiteZone', e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-sm text-white font-medium">Conformité zone</span>
                    <p className="text-xs text-slate-400">L'installation respecte les normes de la zone</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.photosValides}
                    onChange={e => handleChecklistChange('photosValides', e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-sm text-white font-medium">Photos valides</span>
                    <p className="text-xs text-slate-400">Les photos sont claires et complètes</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Indicateur de conformité */}
            <div className={`p-4 rounded-lg border ${allChecked ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
              <div className="flex items-center gap-3">
                {allChecked ? (
                  <Check className="text-green-400" size={24} />
                ) : (
                  <XIcon className="text-orange-400" size={24} />
                )}
                <div>
                  <p className={`font-semibold ${allChecked ? 'text-green-400' : 'text-orange-400'}`}>
                    {allChecked ? 'Conforme' : 'Non conforme'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {allChecked ? 'Tous les points de contrôle sont validés' : 'Certains points de contrôle ne sont pas validés'}
                  </p>
                </div>
              </div>
            </div>

            {/* Observations */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Observations</h3>
              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                placeholder="Notes sur le contrôle qualité..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldCheck size={18} />
                {loading ? 'Enregistrement...' : 'Valider le contrôle'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default MESControlModal;
