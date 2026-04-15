import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Trash2, 
  FileText,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../store/db';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  
  const notifications = useLiveQuery(
    () => db.notifications.orderBy('createdAt').reverse().limit(20).toArray()
  ) || [];

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    await db.notifications.update(id, { read: true });
  };

  const handleClearAll = async () => {
    await db.notifications.where('read').equals(1).delete();
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'approval': return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
      case 'rejection': return { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' };
      default: return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' };
    }
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-all group active:scale-95"
      >
        <Bell size={20} className={`text-slate-400 group-hover:text-white transition-colors ${unreadCount > 0 ? 'animate-swing' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-slate-950 shadow-lg shadow-rose-900/40">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-96 max-h-[600px] bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center">
                    <Bell size={16} className="text-blue-400" />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Flux d'Alertes</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleClearAll}
                    className="p-2 text-slate-500 hover:text-white transition-colors"
                    title="Nettoyer les notifications lues"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-slate-500 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {notifications.length > 0 ? (
                  notifications.map((notif) => {
                    const styles = getTypeStyles(notif.type);
                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => handleMarkAsRead(notif.id)}
                        className={`group p-4 rounded-2xl border cursor-pointer transition-all ${notif.read ? 'bg-white/2 border-white/5 opacity-60 hover:opacity-100' : 'bg-white/5 border-white/10 hover:border-blue-500/30'}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-xl shrink-0 ${styles.bg} ${styles.color}`}>
                            <styles.icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <p className={`text-xs font-black truncate ${notif.read ? 'text-slate-400' : 'text-white'}`}>
                                {notif.title}
                              </p>
                              <span className="text-[9px] font-bold text-slate-500 shrink-0">
                                {format(new Date(notif.createdAt), 'HH:mm', { locale: fr })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                              {notif.message}
                            </p>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 bg-black/20 px-2 py-0.5 rounded">
                                {notif.sender || 'SYSTÈME'}
                              </span>
                              {!notif.read && (
                                <div className="flex items-center gap-1 text-blue-400 text-[9px] font-black">
                                  LIRE
                                  <ArrowRight size={10} />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                    <Bell size={48} className="mb-4 text-slate-500" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Aucune alerte récente</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-black/20 border-t border-white/5">
                <button className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-[0.2em] transition-all">
                  Voir tout l'historique
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
