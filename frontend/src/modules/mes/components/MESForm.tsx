import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, MapPin, Camera, PenTool } from 'lucide-react';
import mesAPI, { type MESRecord } from '@services/mesAPI';
import MESGPSPicker from './MESGPSPicker';
import MESSignatureCanvas from './MESSignatureCanvas';
import MESPhotoManager from './MESPhotoManager';
import toast from 'react-hot-toast';

interface MESFormProps {
  isOpen: boolean;
  onClose: () => void;
  record?: MESRecord | null;
  onSuccess: () => void;
}

type MESStatus = 'RECU' | 'PROGRAMME' | 'EN_COURS' | 'REALISE' | 'CONTROLE' | 'VALIDE' | 'FACTURE' | 'PAYE';

const MESForm: React.FC<MESFormProps> = ({ isOpen, onClose, record, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    avisNumber: '',
    meterNumber: '',
    poste: '',
    zone: '',
    type: 'MONO' as 'MONO' | 'TRI',
    nature: 'POSE' as 'POSE' | 'BRANCHEMENT_POSE',
    cable: '',
    ct70: false,
    pa: false,
    agent: '',
    date: new Date().toISOString().split('T')[0],
    observations: '',
    status: 'RECU' as MESStatus,
    prestataire: 'PROQUELEC' as 'PROQUELEC' | 'UMSAT' | 'AUTRE',
    gpsLat: '',
    gpsLng: '',
    photos: [] as string[],
    clientSignature: '',
  });

  useEffect(() => {
    if (record) {
      setFormData({
        avisNumber: record.avisNumber,
        meterNumber: record.meterNumber,
        poste: record.poste,
        zone: record.zone,
        type: record.type,
        nature: record.nature,
        cable: record.cable || '',
        ct70: record.ct70 || false,
        pa: record.pa || false,
        agent: record.agent,
        date: record.date.split('T')[0],
        observations: record.observations || '',
        status: record.status,
        prestataire: record.prestataire,
        gpsLat: record.gpsLat?.toString() || '',
        gpsLng: record.gpsLng?.toString() || '',
        photos: record.photos || [],
        clientSignature: record.clientSignature || '',
      });
    } else {
      setFormData({
        avisNumber: '',
        meterNumber: '',
        poste: '',
        zone: '',
        type: 'MONO',
        nature: 'POSE',
        cable: '',
        ct70: false,
        pa: false,
        agent: '',
        date: new Date().toISOString().split('T')[0],
        observations: '',
        status: 'RECU',
        prestataire: 'PROQUELEC',
        gpsLat: '',
        gpsLng: '',
        photos: [],
        clientSignature: '',
      });
    }
  }, [record, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        gpsLat: formData.gpsLat ? parseFloat(formData.gpsLat) : undefined,
        gpsLng: formData.gpsLng ? parseFloat(formData.gpsLng) : undefined,
        photos: formData.photos,
        clientSignature: formData.clientSignature,
      };

      if (record) {
        await mesAPI.updateRecord(record.id, payload);
        toast.success('Enregistrement MES mis à jour avec succès');
      } else {
        await mesAPI.createRecord(payload);
        toast.success('Enregistrement MES créé avec succès');
      }

      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde de l\'enregistrement MES');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  if (!isOpen) return null;

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
            <h2 className="text-xl font-bold text-white">
              {record ? 'Modifier l\'enregistrement MES' : 'Nouvel enregistrement MES'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="text-slate-400" size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Informations de l'avis */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Informations de l'avis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Numéro d'avis *
                  </label>
                  <input
                    type="text"
                    name="avisNumber"
                    value={formData.avisNumber}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="AV-XXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Numéro de compteur *
                  </label>
                  <input
                    type="text"
                    name="meterNumber"
                    value={formData.meterNumber}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="CT-XXXXXX"
                  />
                </div>
              </div>
            </div>

            {/* Informations techniques */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Informations techniques</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Poste *
                  </label>
                  <input
                    type="text"
                    name="poste"
                    value={formData.poste}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="POSTE-XX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Zone *
                  </label>
                  <input
                    type="text"
                    name="zone"
                    value={formData.zone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nom de la zone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="MONO">Monophasé (MONO)</option>
                    <option value="TRI">Triphasé (TRI)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Nature *
                  </label>
                  <select
                    name="nature"
                    value={formData.nature}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="POSE">Pose</option>
                    <option value="BRANCHEMENT_POSE">Branchement + Pose</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Câble
                  </label>
                  <input
                    type="text"
                    name="cable"
                    value={formData.cable}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 2x16, 4x16"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Statut *
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="RECU">Reçu</option>
                    <option value="PROGRAMME">Programmé</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="REALISE">Réalisé</option>
                    <option value="CONTROLE">Contrôlé</option>
                    <option value="VALIDE">Validé</option>
                    <option value="FACTURE">Facturé</option>
                    <option value="PAYE">Payé</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="ct70"
                    checked={formData.ct70}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">CT70 requis</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="pa"
                    checked={formData.pa}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Protection Automatique (PA)</span>
                </label>
              </div>
            </div>

            {/* Intervention */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Intervention</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Agent *
                  </label>
                  <input
                    type="text"
                    name="agent"
                    value={formData.agent}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nom de l'agent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Prestataire *
                  </label>
                  <select
                    name="prestataire"
                    value={formData.prestataire}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="PROQUELEC">PROQUELEC</option>
                    <option value="UMSAT">UMSAT</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Géolocalisation */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MapPin size={18} />
                Géolocalisation GPS
              </h3>
              <MESGPSPicker
                lat={formData.gpsLat}
                lng={formData.gpsLng}
                onLatChange={(value) => setFormData(prev => ({ ...prev, gpsLat: value }))}
                onLngChange={(value) => setFormData(prev => ({ ...prev, gpsLng: value }))}
              />
            </div>

            {/* Photos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Camera size={18} />
                Photos
              </h3>
              <MESPhotoManager
                photos={formData.photos}
                onChange={(photos) => setFormData(prev => ({ ...prev, photos }))}
                maxPhotos={10}
              />
            </div>

            {/* Signature client */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <PenTool size={18} />
                Signature client
              </h3>
              <MESSignatureCanvas
                value={formData.clientSignature}
                onChange={(value) => setFormData(prev => ({ ...prev, clientSignature: value }))}
              />
            </div>

            {/* Observations */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Observations</h3>
              <textarea
                name="observations"
                value={formData.observations}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Notes sur l'intervention..."
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
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {loading ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default MESForm;
