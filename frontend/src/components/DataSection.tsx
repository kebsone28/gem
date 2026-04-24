/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Zap, RefreshCw, Database } from 'lucide-react';
import { useTeams } from '../hooks/useTeams';
import logger from '../utils/logger';
import toast from 'react-hot-toast';
import apiClient from '../api/client';

export function DataSection({
  project,
  households,
  onUpdate,
}: {
  project: any;
  households: any[];
  onUpdate: any;
}) {
  const { fetchGrappes } = useTeams(project?.id);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleReorganizeGrappes = async () => {
    if (!project?.id) {
      toast.error('Aucun projet actif valide sélectionné.');
      return;
    }
    if (!households || households.length === 0) {
      toast.error("Aucune donnée de ménages. Synchronisez d'abord vos données terrain.");
      return;
    }
    if (
      !window.confirm(
        `Lancer le recalcul spatial sur le serveur pour ${households.length} ménages ? Cette action mettra à jour la carte et le bordereau.`
      )
    )
      return;

    setIsProcessing(true);
    try {
      const response = await apiClient.post(`/projects/${project.id}/recalculate-grappes`);
      logger.log(`🗂️ [SERVER-GRAPPES] Response:`, response.data);

      await fetchGrappes();
      toast.success('✅ Recalcul spatial terminé avec succès !');
    } catch (err: any) {
      logger.error(err);
      toast.error('Erreur lors du recalcul : ' + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight mb-1">
          <Database className="text-blue-500" />
          Maintenance des Données
        </h2>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Outils avancés de gestion de la base de données locale
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Grappe Recalculation */}
        <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
              <Zap className="text-blue-400" size={24} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">
                Réorganisation des Grappes
              </h3>
              <p className="text-rose-500/60 text-[10px] font-black uppercase tracking-[0.2em]">
                Calcul spatial basé sur les coordonnées
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-bold uppercase leading-relaxed">
            Recalcule automatiquement les grappes et sous-grappes à partir des coordonnées GPS des
            ménages synchronisés.
          </p>
          <button
            onClick={handleReorganizeGrappes}
            disabled={isProcessing}
            className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="animate-spin" size={16} />
                CALCUL EN COURS...
              </div>
            ) : (
              'LANCER LE RECALCUL SPATIAL'
            )}
          </button>
        </div>

        {/* Database Reset */}
        <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-600/20 rounded-2xl flex items-center justify-center border border-rose-500/30">
              <RefreshCw className="text-rose-400" size={24} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">
                Réinitialisation Cache
              </h3>
              <p className="text-rose-500/60 text-[10px] font-black uppercase tracking-[0.2em]">
                Nettoyage complet de la base de données locale (Sauf cloud sync)
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (window.confirm("Voulez-vous vraiment réinitialiser le cache local ? Toutes les modifications non synchronisées pourraient être perdues.")) {
                if (onUpdate) onUpdate();
              }
            }}
            className="px-8 py-4 bg-rose-600/20 border border-rose-600/30 text-rose-500 text-xs font-black uppercase tracking-widest rounded-xl transition-all hover:bg-rose-600 hover:text-white active:scale-95 whitespace-nowrap shadow-lg">
            RÉINITIALISER LES DONNÉES
          </button>
        </div>
      </div>
    </div>
  );
}
