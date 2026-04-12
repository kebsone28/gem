import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Gauge, Zap, TrendingUp, Calendar, Hash, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface TeamSizingModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalHouseholds?: number;
}

export const TeamSizingModal: React.FC<TeamSizingModalProps> = ({
  isOpen,
  onClose,
  totalHouseholds = 2500,
}) => {
  const [targetMonths, setTargetMonths] = useState<number>(3);
  const [maconRate, setMaconRate] = useState<number>(5);
  const [livreurRate, setLivreurRate] = useState<number>(15);
  const [elecRate, setElecRate] = useState<number>(10);

  const [isLoading, setIsLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [credentials, setCredentials] = useState<any[] | null>(null);

  const checkRecommendation = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('gem_token');
      const res = await fetch('/api/sizing/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetMonths,
          totalHouseholds,
          customRates: { macon: maconRate, livreur: livreurRate, elec: elecRate },
        }),
      });

      if (!res.ok) throw new Error("Erreur lors de l'analyse");
      const data = await res.json();
      setRecommendation(data);
    } catch (error: any) {
      toast.error(error.message || "Impossible de contacter l'IA de Sizing.");
    } finally {
      setIsLoading(false);
    }
  };

  const applyScale = async () => {
    if (!recommendation) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('gem_token');
      const res = await fetch('/api/sizing/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deltas: recommendation.delta }),
      });

      if (!res.ok) throw new Error('Erreur de déploiement');
      const data = await res.json();

      toast.success(data.message || 'Déploiement réussi !');
      setCredentials(data.credentials);
    } catch (error: any) {
      toast.error(error.message || 'Erreur de création système.');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-blue-950/30 to-indigo-950/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
                <Bot size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">IA Auto-Sizing & Scale</h2>
                <p className="text-xs text-blue-400 font-medium tracking-wide">
                  Dimensionnement Prédictif des Équipes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              title="Fermer"
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            {!credentials ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Parameters */}
                <div className="space-y-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                      <Gauge size={16} className="text-indigo-400" />
                      Contraintes du Projet
                    </h3>

                    <div>
                      <label
                        htmlFor="targetMonths"
                        className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5"
                      >
                        <Calendar size={12} /> Délai global (Mois)
                      </label>
                      <input
                        id="targetMonths"
                        title="Délai global en mois"
                        type="number"
                        min="1"
                        max="24"
                        value={targetMonths}
                        onChange={(e) => setTargetMonths(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-3 outline-none focus:border-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="totalHouseholds"
                        className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5"
                      >
                        <Hash size={12} /> Quantité estimée de Foyers
                      </label>
                      <input
                        id="totalHouseholds"
                        title="Quantité estimée de Foyers"
                        type="number"
                        min="1"
                        value={totalHouseholds}
                        disabled
                        className="w-full bg-slate-950/50 border border-slate-800 text-slate-400 rounded-lg p-3 text-sm cursor-not-allowed"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Calculé via la base de données Kobo.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp size={16} className="text-indigo-400" />
                      KPIs de Production (Foyers / Jour / Équipe)
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label
                          htmlFor="maconRate"
                          className="text-[10px] uppercase text-slate-500 font-bold block mb-1"
                        >
                          Maçons
                        </label>
                        <input
                          id="maconRate"
                          title="Ratio Maçons"
                          type="number"
                          value={maconRate}
                          onChange={(e) => setMaconRate(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 outline-none text-center text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="elecRate"
                          className="text-[10px] uppercase text-slate-500 font-bold block mb-1"
                        >
                          Électriciens
                        </label>
                        <input
                          id="elecRate"
                          title="Ratio Électriciens"
                          type="number"
                          value={elecRate}
                          onChange={(e) => setElecRate(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 outline-none text-center text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="livreurRate"
                          className="text-[10px] uppercase text-slate-500 font-bold block mb-1"
                        >
                          Livreurs
                        </label>
                        <input
                          id="livreurRate"
                          title="Ratio Livreurs"
                          type="number"
                          value={livreurRate}
                          onChange={(e) => setLivreurRate(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2 outline-none text-center text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={checkRecommendation}
                    disabled={isLoading}
                    className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black flex justify-center items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Bot size={18} />
                    )}
                    Analyser
                  </button>
                </div>

                {/* Right: Neural Recommendation Results */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col">
                  {!recommendation ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                      <Zap size={48} className="mb-4 text-slate-700 opacity-20" />
                      <p className="text-sm font-semibold max-w-[200px] text-center">
                        Lancez l'analyse pour calculer les renforts nécessaires.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 p-3 rounded-lg border border-emerald-400/20">
                        <CheckCircle2 size={18} />
                        <span className="text-sm font-bold">Modèle prédictif généré</span>
                      </div>

                      <div className="space-y-4">
                        {Object.entries(recommendation.delta).map(([role, amount]: any) => (
                          <div
                            key={role}
                            className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800"
                          >
                            <div>
                              <div className="text-sm font-bold text-white uppercase">{role}</div>
                              <div className="text-xs text-slate-500">
                                Actuels: {recommendation.current[role]} | Requis:{' '}
                                {recommendation.required[role]}
                              </div>
                            </div>
                            <div
                              className={`text-2xl font-black ${amount > 0 ? 'text-indigo-400' : 'text-slate-600'}`}
                            >
                              {amount > 0 ? `+${amount}` : 'OK'}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto pt-4">
                        <button
                          onClick={applyScale}
                          disabled={
                            isLoading ||
                            Object.values(recommendation.delta).every((v: any) => v <= 0)
                          }
                          className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-600/30 font-black uppercase tracking-wider text-sm"
                        >
                          Deploy & Auto-Scale
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 px-4 text-center max-w-xl mx-auto space-y-6">
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-black text-white">Création Réussie !</h2>
                <p className="text-slate-400 text-sm">
                  Le système a automatiquement provisionné les comptes sur le Cloud et rattaché les
                  équipes virtuelles.
                </p>

                <div className="text-left bg-slate-900 border border-slate-800 rounded-xl p-4 mt-6">
                  <p className="text-indigo-400 font-bold text-xs uppercase mb-3">
                    Identifiants pour les sous-traitants :
                  </p>
                  <ul className="space-y-3">
                    {credentials.map((cred, i) => (
                      <li key={i} className="text-sm flex flex-col p-2 bg-slate-950 rounded-lg">
                        <span className="text-slate-200 font-bold">{cred.teamName}</span>
                        <span className="text-slate-500">Email: {cred.email}</span>
                        <span className="text-slate-500">
                          Mot de passe: <code className="text-emerald-400">{cred.pass}</code>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setCredentials(null);
                    onClose();
                  }}
                  className="mt-6 w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700"
                >
                  Terminer
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
