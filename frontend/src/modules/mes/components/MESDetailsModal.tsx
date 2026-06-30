import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Calendar, User, Building, Zap, FileText, ShieldCheck, CheckCircle, Clock } from 'lucide-react';
import { type MESRecord } from '@services/mesAPI';

interface MESDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: MESRecord | null;
}

const MESDetailsModal: React.FC<MESDetailsModalProps> = ({ isOpen, onClose, record }) => {
  if (!isOpen || !record) return null;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      RECU: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
      PROGRAMME: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400',
      EN_COURS: 'bg-orange-500/10 border-orange-500/50 text-orange-400',
      REALISE: 'bg-purple-500/10 border-purple-500/50 text-purple-400',
      CONTROLE: 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400',
      VALIDE: 'bg-green-500/10 border-green-500/50 text-green-400',
      FACTURE: 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400',
      PAYE: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400',
    };
    return colors[status] || 'bg-slate-500/10 border-slate-500/50 text-slate-400';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      RECU: 'Reçu',
      PROGRAMME: 'Programmé',
      EN_COURS: 'En cours',
      REALISE: 'Réalisé',
      CONTROLE: 'Contrôlé',
      VALIDE: 'Validé',
      FACTURE: 'Facturé',
      PAYE: 'Payé',
    };
    return labels[status] || status;
  };

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
          className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Détails de l'enregistrement MES</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="text-slate-400" size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* En-tête avec statut */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Avis Senelec</p>
                <p className="text-2xl font-bold text-white">{record.avisNumber}</p>
              </div>
              <span className={`px-4 py-2 rounded-lg text-sm font-bold ${getStatusColor(record.status)}`}>
                {getStatusLabel(record.status)}
              </span>
            </div>

            {/* Informations de l'avis */}
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText size={18} />
                Informations de l'avis
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Numéro de compteur</p>
                  <p className="text-sm text-white font-medium">{record.meterNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Poste</p>
                  <p className="text-sm text-white font-medium">{record.poste}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Zone</p>
                  <p className="text-sm text-white font-medium">{record.zone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Prestataire</p>
                  <p className="text-sm text-white font-medium">{record.prestataire}</p>
                </div>
              </div>
            </div>

            {/* Informations techniques */}
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap size={18} />
                Informations techniques
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Type</p>
                  <p className="text-sm text-white font-medium">{record.type === 'MONO' ? 'Monophasé' : 'Triphasé'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Nature</p>
                  <p className="text-sm text-white font-medium">{record.nature === 'POSE' ? 'Pose' : 'Branchement + Pose'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Câble</p>
                  <p className="text-sm text-white	font-medium">{record.cable || 'Non spécifié'}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${record.ct70 ? 'bg-green-500' : 'bg-slate-600'}`} />
                    <span className="text-xs text-slate-400">CT70</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${record.pa ? 'bg-green-500' : 'bg-slate-600'}`} />
                    <span className="text-xs text-slate-400">PA</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Intervention */}
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <User size={18} />
                Intervention
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Agent</p>
                  <p className="text-sm text-white font-medium">{record.agent}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1 flex items-center gap-2">
                    <Calendar size={14} />
                    Date
                  </p>
                  <p className="text-sm text-white font-medium">{new Date(record.date).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
            </div>

            {/* Géolocalisation */}
            {record.gpsLat && record.gpsLng && (
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MapPin size={18} />
                  Géolocalisation
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Latitude</p>
                    <p className="text-sm text-white font-medium">{record.gpsLat}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Longitude</p>
                    <p className="text-sm text-white font-medium">{record.gpsLng}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Contrôle et validation */}
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ShieldCheck size={18} />
                Contrôle et validation
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${record.controlled ? 'bg-green-500/20' : 'bg-slate-700'}`}>
                    <CheckCircle size={16} className={record.controlled ? 'text-green-400' : 'text-slate-400'} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Contrôlé</p>
                    <p className="text-sm text-white font-medium">{record.controlled ? 'Oui' : 'Non'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${record.validated ? 'bg-green-500/20' : 'bg-slate-700'}`}>
                    <CheckCircle size={16} className={record.validated ? 'text-green-400' : 'text-slate-400'} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Validé</p>
                    <p className="text-sm text-white font-medium">{record.validated ? 'Oui' : 'Non'}</p>
                  </div>
                </div>
              </div>
              {record.controlDate && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock size={14} />
                  <span>Contrôle le {new Date(record.controlDate).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
              {record.validationDate && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock size={14} />
                  <span>Validation le {new Date(record.validationDate).toLocaleDateString('fr-FR')}</span>
                </div>
              )}
            </div>

            {/* Observations */}
            {record.observations && (
              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Observations</h3>
                <p className="text-sm text-slate-300">{record.observations}</p>
              </div>
            )}

            {/* Métadonnées */}
            <div className="text-xs text-slate-500 space-y-1">
              <p>Créé le {new Date(record.createdAt).toLocaleString('fr-FR')}</p>
              <p>Mis à jour le {new Date(record.updatedAt).toLocaleString('fr-FR')}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default MESDetailsModal;
