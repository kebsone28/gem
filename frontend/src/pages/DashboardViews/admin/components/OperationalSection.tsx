import React from 'react';
import { LayoutGrid, Box, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProgressBar } from '../../../../components/dashboards/DashboardComponents';
import { fmtNum } from '../../../../utils/format';
import { useNavigate } from 'react-router-dom';
import type { DashboardMetrics } from '../types';

interface OperationalSectionProps {
  metrics: DashboardMetrics;
  zonesCount: number;
}

export const OperationalSection: React.FC<OperationalSectionProps> = ({ metrics, zonesCount }) => {
  const navigate = useNavigate();
  const total = metrics.totalHouseholds || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-8 space-y-10">
        <div className="p-6 md:p-10 rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 pb-8 border-b border-white/5">
            <div className="space-y-1">
              <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] flex items-center gap-3 italic text-white">
                <LayoutGrid size={18} className="text-blue-500" /> FLUX OPÉRATIONNEL DES TRAVAUX
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">
                {zonesCount > 0 ? `SYNCHRONISÉ AVEC ${zonesCount} ZONES OPÉRATIONNELLES` : 'EN ATTENTE DE CARTOGRAPHIE'}
              </p>
            </div>
            <button
              onClick={() => navigate('/bordereau')}
              className="h-10 px-6 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 text-blue-400 hover:text-white rounded-full text-[9px] font-black uppercase tracking-widest transition-all italic active:scale-95"
            >
              ANALYSE DÉTAILLÉE →
            </button>
          </div>

          <div className="space-y-8">
            <ProgressBar
              label="Maçonnerie Structurelle"
              count={`${metrics.pipeline.murs} SITES`}
              percentage={Math.round((metrics.pipeline.murs / total) * 100)}
            />
            <ProgressBar
              label="Réseaux & Infrastructures"
              count={`${metrics.pipeline.reseau} SITES`}
              percentage={Math.round((metrics.pipeline.reseau / total) * 100)}
            />
            <ProgressBar
              label="Installations Intérieures"
              count={`${metrics.pipeline.interieur} SITES`}
              percentage={Math.round((metrics.pipeline.interieur / total) * 100)}
            />
            <ProgressBar
              label="Mise en Service Finale"
              count={`${metrics.electrifiedHouseholds} SITES`}
              percentage={metrics.progressPercent}
              status="success"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 md:p-10 rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-xl">
            <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] mb-8 italic flex items-center gap-3 text-white">
              <Box size={18} className="text-blue-500" /> SUIVI LOGISTIQUE
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white/[0.03] p-6 rounded-2xl border border-white/5 group hover:bg-white/[0.05] transition-all">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic group-hover:text-blue-400 transition-colors">KITS DÉPLOYÉS</span>
                <span className="text-2xl font-black text-white italic">{fmtNum(metrics.logistics.kitPrepared)}</span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.03] p-6 rounded-2xl border border-white/5 group hover:bg-white/[0.05] transition-all">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic group-hover:text-blue-400 transition-colors">CÂBLE MOYEN / MÉNAGE</span>
                <span className="text-2xl font-black text-white italic">{metrics.performance.avgCablePerHouse}m</span>
              </div>
              <div className="flex justify-between items-center bg-rose-500/5 p-6 rounded-2xl border border-rose-500/10">
                <span className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest italic">ÉCART LOGISTIQUE</span>
                <span className="text-2xl font-black text-rose-500 italic">-{metrics.logistics.gap}</span>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-10 rounded-3xl md:rounded-[3rem] bg-slate-900/40 border border-white/5 backdrop-blur-3xl shadow-xl flex flex-col">
            <h3 className="text-[11px] font-black text-blue-400/40 uppercase tracking-[0.4em] mb-4 italic flex items-center gap-3 text-white">
              <Activity size={18} className="text-blue-500" /> GÉNÉRATION JOURNALIÈRE
            </h3>
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <div className="text-7xl font-black text-white italic tracking-tighter drop-shadow-xl">{metrics.performance.avgPerDay}</div>
              <p className="text-[10px] font-black text-blue-500/40 uppercase tracking-[0.3em] mt-2 italic">RENDEMENT MOYEN / JOUR</p>
              <div className="w-full h-24 flex items-end justify-between px-4 gap-2 mt-10">
                {[40, 60, 45, 75, 80, 95, 85].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    className="flex-1 bg-blue-600/30 rounded-t-lg hover:bg-blue-500 transition-colors cursor-pointer"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
