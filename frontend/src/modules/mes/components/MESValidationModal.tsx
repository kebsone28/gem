import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import mesAPI, { type MESRecord } from '@services/mesAPI';
import toast from 'react-hot-toast';

interface MESValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MESRecord | null;
  onSuccess: () => void;
}

const MESValidationModal: React.FC<MESValidationModalProps> = ({ isOpen, onClose, record, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    if (!record) return;

    setLoading(true);

    try {
      await mesAPI.validateRecord(record.id);
      toast.success('Enregistrement MES validé avec succès');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Erreur lors de la validation de l\'enregistrement MES');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !record) return null;

  const isControlled = record.status === 'CONTROLE' || record.controlled;

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
          className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="text-green-400" size={20} />
              </div>
              <h2 className="text-xl font-bold text-white">Validation MES</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="text-slate-400" size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
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
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Statut actuel:</span>
                <span className="text-sm text-white font-medium">{record.status}</span>
              </div>
            </div>

            {/* Avertissement si non contrôlé */}
            {!isControlled && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-orange-400 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-medium text-orange-400">Attention</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Cet enregistrement n'a pas encore été contrôlé. Il est recommandé d'effectuer un contrôle qualité avant la validation.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation */}
            <div className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-sm text-slate-300">
                Êtes-vous sûr de vouloir valider cet enregistrement MES ? Cette action changera le statut à "VALIDE" et permettra la facturation.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleValidate}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={18} />
                {loading ? 'Validation...' : 'Valider'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default MESValidationModal;
