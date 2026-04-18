import React from 'react';
import { Package, AlertTriangle, TrendingUp, Warehouse, Zap, Clock, Info } from 'lucide-react';
import { useLogistique } from '../../hooks/useLogistique';
import { motion } from 'framer-motion';
import { fmtNum } from '../../utils/format';

export default function StockMonitorWidget() {
  const { warehouseStats, globalStats, isLoading } = useLogistique();

  if (isLoading) return (
    <div className="glass-card animate-pulse h-48 flex items-center justify-center">
      <div className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Initialisation Logistique...</div>
    </div>
  );

  // Trouver les articles avec les alertes les plus critiques à travers tous les magasins
  const criticalItems = warehouseStats?.flatMap(wh => 
    wh.alerts.map((alert: any) => ({ ...alert, warehouseName: wh.name }))
  ).sort((a, b) => (a.remaining / a.qty) - (b.remaining / b.qty)).slice(0, 5) || [];

  const hasCriticalAlerts = criticalItems.length > 0;

  return (
    <div className="glass-card !p-6 !rounded-[2.5rem] border-white/5 bg-gradient-to-br from-slate-900/40 to-slate-950/60 relative overflow-hidden group">
      {/* Glow Effect */}
      <div className={`absolute -right-20 -top-20 w-64 h-64 blur-[100px] rounded-full transition-all duration-1000 ${hasCriticalAlerts ? 'bg-rose-500/10' : 'bg-emerald-500/5'}`} />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${hasCriticalAlerts ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
            <Package size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase italic tracking-tight">Santé Logistique</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">État Global des Stocks</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${hasCriticalAlerts ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                {hasCriticalAlerts ? 'Alertes Actives' : 'Stock Optimal'}
            </div>
        </div>
      </div>

      {!hasCriticalAlerts ? (
        <div className="py-8 text-center relative z-10">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500">
            <Zap size={24} />
          </div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Flux logistique nominal</p>
          <p className="text-[9px] text-slate-600 uppercase mt-1">Tous les magasins sont approvisionnés pour {'>'} 7 jours</p>
        </div>
      ) : (
        <div className="space-y-3 relative z-10">
          {criticalItems.map((item, idx) => {
            const teamVelocity = warehouseStats?.find(w => w.name === item.warehouseName)?.teamVelocity || 0;
            const rawDays = teamVelocity > 0 ? Math.round(item.remaining / (item.qty * teamVelocity)) : 99;
            const daysLeft = isFinite(rawDays) ? rawDays : 99;
            const isCritical = daysLeft <= 3;
            
            return (
              <motion.div 
                key={`${item.warehouseName}-${item.label}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`p-3 rounded-2xl border ${isCritical ? 'bg-rose-500/5 border-rose-500/10' : 'bg-white/2 border-white/5'} flex items-center gap-3 group/item hover:bg-white/5 transition-all`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCritical ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                  {isCritical ? <AlertTriangle size={18} /> : <Clock size={18} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-black text-white uppercase truncate">{item.label}</span>
                    <span className={`text-[10px] font-black ${isCritical ? 'text-rose-500' : 'text-amber-500'}`}>
                      {fmtNum(item.remaining)} {item.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Warehouse size={10} /> {item.warehouseName}
                    </span>
                    <span className={`text-[8px] font-black uppercase tracking-tighter ${isCritical ? 'text-rose-400' : 'text-amber-400'}`}>
                      Rupture sous {daysLeft}j
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          <div className="pt-2 border-t border-white/5 mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <TrendingUp size={12} className="text-blue-400" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Vitesse globale : {globalStats.totalConsumed > 0 ? Math.round(globalStats.totalConsumed / 30) : 0} kits/j</span>
            </div>
            <button className="text-[9px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-all">
                Détails Logistique →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
