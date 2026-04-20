/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React, { useState, useEffect, useMemo, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Trash2, 
  ArrowRight,
  Zap
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../store/db';
import { syncEventBus } from '../../utils/syncEventBus';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { audioService } from '../../services/audioService';
import { toast } from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENT: NotificationItem (Memoized to prevent massive re-renders)
   ───────────────────────────────────────────────────────────────────────────── */
const NotificationItem = memo(({ notif, onRead, onDelete, styles }: { notif: any, onRead: (id: string) => void, onDelete: (id: string, e: React.MouseEvent) => void, styles: any }) => {
  // Memoize date formatting to avoid repeated calculations
  const formattedTime = useMemo(() => 
    format(new Date(notif.createdAt), 'HH:mm', { locale: fr }), 
    [notif.createdAt]
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      onClick={() => onRead(notif.id)}
      className={`group p-4 rounded-2xl border cursor-pointer transition-all ${
        notif.read ? 'bg-white/2 border-white/5 opacity-60 hover:opacity-100' : 'bg-white/5 border-white/10 hover:border-blue-500/30'
      }`}
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
              {formattedTime}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
            {notif.message}
          </p>
          <div className="flex items-center justify-between mt-3">
             <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 bg-black/20 px-2 py-0.5 rounded">
                  {notif.sender || 'SYSTÈME'}
                </span>
                <button 
                  onClick={(e) => onDelete(notif.id, e)}
                  className="p-1 text-slate-600 hover:text-rose-500 transition-colors"
                  title="Supprimer cette alerte"
                  aria-label="Supprimer cette alerte"
                >
                  <Trash2 size={12} />
                </button>
             </div>
            {!notif.read && (
              <div className="flex items-center gap-1 text-blue-400 text-[9px] font-black group-hover:translate-x-1 transition-transform">
                LIRE
                <ArrowRight size={10} />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT: NotificationCenter
   ───────────────────────────────────────────────────────────────────────────── */
export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'approval' | 'system'>('all');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const navigate = useNavigate();
  const lastCountRef = useRef(0);
  
  // RAW DATA from DB
  const rawNotifications = useLiveQuery(
    () => db.notifications.orderBy('createdAt').reverse().limit(20).toArray(),
    []
  ) || [];

  // 1️⃣ BUFFERING SYSTEM (Batching UI updates to prevent "Sync Freeze")
  const [bufferedNotifs, setBufferedNotifs] = useState<any[]>([]);
  
  useEffect(() => {
    if (rawNotifications.length > lastCountRef.current) {
      if (lastCountRef.current > 0) {
        audioService.playPing();
      }
      lastCountRef.current = rawNotifications.length;
    }

    const timeout = setTimeout(() => {
      setBufferedNotifs(rawNotifications);
    }, 150); // Small buffer to handle high-frequency DB writes
    return () => clearTimeout(timeout);
  }, [rawNotifications]);

  // 3️⃣ GLOBAL TOAST SYSTEM (React State vs DOM Injection)
  const [toasts, setToasts] = useState<any[]>([]);

  useEffect(() => {
    // S'abonner aux notifications WebSockets via notre EventBus propre
    const unsubscribe = syncEventBus.subscribe('notification', async (data: any) => {
      const newToast = { id: Date.now(), ...data };
      
      // Afficher le toast flottant
      setToasts(prev => [...prev, newToast]);
      audioService.playPing(); // Son de notification

      // Push Native Notification
      if (Notification.permission === 'granted') {
          new Notification(data.title || "Alerte GEM SAAS", {
              body: data.message || "Nouvel événement système reçu.",
              icon: '/logo-proquelec.png'
          });
      }

      // Sauvegarder dans l'historique Dexie (Utiliser put pour éviter les ConstraintError)
      try {
        await db.notifications.put({
          id: data.id || Date.now().toString(),
          title: data.message || 'Nouvelle notification',
          message: data.type === 'SYNC' ? 'Synchronisation Cloud exécutée' : (data.detail || 'Opération système enregistrée'),
          type: data.type === 'SYNC' ? 'system' : 'approval',
          sender: data.sender || 'SYSTÈME',
          read: false,
          archived: false,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Erreur lors de la sauvegarde de la notification:', error);
      }

      // Supprimer le toast après 5 secondes
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 5000);
    });

    return unsubscribe;
  }, []);

  const unreadCount = useMemo(() => bufferedNotifs.filter(n => !n.read).length, [bufferedNotifs]);

  const handleMarkAsRead = async (id: string) => {
    const target = bufferedNotifs.find(n => n.id === id);
    if (!target || target.read) return;

    // Local update first
    setBufferedNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    
    // Remote update
    await db.notifications.update(id, { read: true });
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = bufferedNotifs.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setBufferedNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await db.notifications.where('id').anyOf(unreadIds).modify({ read: true });
    toast.success(`${unreadIds.length} alertes marquées comme lues`);
  };

  const handleRequestPermission = async () => {
      if (typeof Notification !== 'undefined') {
          const permission = await Notification.requestPermission();
          setNotifPermission(permission);
          if (permission === 'granted') toast.success("Notifications système activées");
      }
  };

  const filteredNotifs = useMemo(() => {
    if (activeFilter === 'all') return bufferedNotifs;
    return bufferedNotifs.filter(n => 
        activeFilter === 'approval' ? (n.type === 'approval' || n.type === 'rejection') : n.type === 'system'
    );
  }, [bufferedNotifs, activeFilter]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering onRead
    setBufferedNotifs(prev => prev.filter(n => n.id !== id));
    await db.notifications.delete(id);
  };

  const handleClearAll = async () => {
    // Correct Dexie query for boolean field 'read'
    const toDelete = await db.notifications.where('read').equals(true as any).toArray();
    if (toDelete.length > 0) {
      await db.notifications.bulkDelete(toDelete.map(n => n.id));
      setBufferedNotifs(prev => prev.filter(n => !n.read));
    }
  };

  const getItemStyles = (type: string) => {
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
        title="Ouvrir le flux des alertes système"
        aria-label={`Ouvrir le flux des alertes système. ${unreadCount} non lues.`}
        className="relative p-2.5 rounded-2xl bg-slate-900/50 border border-white/5 hover:bg-slate-800 transition-all group active:scale-95"
      >
        <Bell size={20} className={`text-slate-400 group-hover:text-white transition-colors ${unreadCount > 0 ? 'animate-swing' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-slate-950 shadow-lg shadow-rose-900/40">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Panel Portaled to Body to avoid Clipping by Sidebar Transforms */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 z-[9998] bg-slate-950/60 backdrop-blur-sm"
              />

              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed left-4 right-4 top-16 lg:left-80 lg:right-auto lg:top-8 w-auto lg:w-96 h-[calc(100vh-100px)] lg:h-[calc(100vh-64px)] bg-slate-900/90 backdrop-blur-md lg:backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl z-[9999] overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="shrink-0 p-6 border-b border-white/5 bg-gradient-to-r from-blue-500/5 to-transparent">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center">
                            <Bell size={16} className="text-blue-400" />
                        </div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Flux d'Alertes</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        {notifPermission !== 'granted' && (
                            <button 
                                onClick={handleRequestPermission}
                                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                                title="Activer les notifications Windows"
                                aria-label="Activer les notifications Windows"
                            >
                                <Zap size={14} />
                            </button>
                        )}
                        <button 
                            onClick={handleMarkAllAsRead}
                            className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                            title="Tout marquer comme lu"
                            aria-label="Tout marquer comme lu"
                        >
                            <CheckCircle2 size={16} />
                        </button>
                        <button 
                            onClick={handleClearAll}
                            className="p-2 text-slate-500 hover:text-white transition-colors"
                            title="Nettoyer l'historique lu"
                            aria-label="Nettoyer l'historique lu"
                        >
                            <Trash2 size={16} />
                        </button>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-2 text-slate-500 hover:text-white transition-colors"
                            title="Fermer le panneau"
                            aria-label="Fermer le panneau"
                        >
                            <X size={18} />
                        </button>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl">
                      {[
                        { id: 'all', label: 'Toutes', count: bufferedNotifs.length },
                        { id: 'approval', label: 'Missions', count: bufferedNotifs.filter(n => n.type === 'approval' || n.type === 'rejection').length },
                        { id: 'system', label: 'Système', count: bufferedNotifs.filter(n => n.type === 'system').length }
                      ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveFilter(tab.id as any)}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                                activeFilter === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                            }`}
                          >
                              {tab.label} ({tab.count})
                          </button>
                      ))}
                  </div>
                </div>

                {/* Scroll Area */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {filteredNotifs.length > 0 ? (
                    filteredNotifs.map((notif) => (
                      <NotificationItem 
                        key={notif.id} 
                        notif={notif} 
                        onRead={handleMarkAsRead}
                        onDelete={handleDelete}
                        styles={getItemStyles(notif.type)}
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                      <Bell size={48} className="mb-4 text-slate-500" />
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Aucune alerte récente</p>
                    </div>
                  )}
                </div>

                {/* Gradient Fade Effect (UX Polish) */}
                <div className="pointer-events-none absolute bottom-20 left-0 right-0 h-8 bg-gradient-to-t from-slate-900 to-transparent" />

                {/* Footer */}
                <div className="shrink-0 p-4 bg-black/20 border-t border-white/5">
                  <button 
                    title="Accéder à l'archive complète de vos notifications depuis le début de la mission"
                    aria-label="Voir tout l'historique des notifications"
                    onClick={() => {
                        setIsOpen(false);
                        navigate('/admin/alerts');
                    }}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-[0.2em] transition-all"
                  >
                    Voir tout l'historique
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Floating Toasts Area (Portaled via strict React state) */}
      {typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.4, type: 'spring', bounce: 0.4 }}
                className="pointer-events-auto bg-indigo-600/95 backdrop-blur-xl border border-indigo-400/30 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[300px]"
              >
                <div className="px-3 py-2 bg-white/20 rounded-xl text-xl shrink-0 border border-white/10 shadow-inner">
                  📡
                </div>
                <div>
                   <h4 className="font-black text-sm tracking-tight drop-shadow-md">
                     {t.message || 'Mise à jour entrante'}
                   </h4>
                   <p className="text-[11px] text-indigo-100 mt-0.5 font-medium leading-tight">
                     {t.type === 'SYNC' ? 'Données synchronisées depuis le cloud.' : (t.detail || 'Alerte temps réel reçue.')}
                   </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </div>
  );
}
