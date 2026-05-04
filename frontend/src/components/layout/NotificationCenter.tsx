/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
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
import logger from '../../utils/logger';

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
      className={`group rounded-2xl border p-3.5 cursor-pointer transition-all ${
        notif.read ? 'bg-white/[0.025] border-white/6 opacity-60 hover:opacity-100' : 'bg-white/[0.045] border-white/10 hover:border-blue-500/25 hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`shrink-0 rounded-xl p-2 ${styles.bg} ${styles.color}`}>
          <styles.icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <p className={`truncate text-[12px] font-semibold ${notif.read ? 'text-slate-400' : 'text-white'}`}>
              {notif.title}
            </p>
            <span className="shrink-0 text-[10px] font-medium text-slate-500">
              {formattedTime}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400 line-clamp-2">
            {notif.message}
          </p>
          <div className="flex items-center justify-between mt-3">
             <div className="flex items-center gap-2">
                <span className="rounded-md bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {notif.sender || 'SYSTÈME'}
                </span>
                <button 
                  onClick={(e) => onDelete(notif.id, e)}
                  className="p-1 text-slate-600 transition-colors hover:text-rose-400"
                  title="Supprimer cette alerte"
                  aria-label="Supprimer cette alerte"
                >
                  <Trash2 size={12} />
                </button>
             </div>
            {!notif.read && (
              <div className="flex items-center gap-1 text-[9px] font-semibold text-blue-300 transition-transform group-hover:translate-x-1">
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
      // 🚫 Ignorer complètement les notifications de synchronisation automatique ("SYNC")
      // Cela évite de spammer l'utilisateur avec des toasts bleus et des sons à chaque
      // changement si l'Auto-Save est activé.
      if (data.type === 'SYNC') {
        return;
      }

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
        logger.warn('[NotificationCenter] Erreur lors de la sauvegarde de la notification', error);
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
        className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-slate-300 transition-all hover:border-white/12 hover:bg-white/[0.08] hover:text-white active:scale-95"
      >
        <Bell size={18} className={`transition-colors ${unreadCount > 0 ? 'animate-swing' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-slate-900 bg-rose-500 px-1 text-[10px] font-bold text-white shadow-[0_8px_18px_rgba(244,63,94,0.35)]">
            {unreadCount > 9 ? '9+' : unreadCount}
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
                className="fixed left-3 right-3 top-14 z-[9999] flex h-[calc(100vh-84px)] w-auto flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(5,10,20,0.98))] shadow-[0_30px_90px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:left-80 lg:right-auto lg:top-8 lg:h-[calc(100vh-64px)] lg:w-[23rem] lg:rounded-[2.4rem]"
              >
                {/* Header */}
                <div className="shrink-0 border-b border-white/6 bg-gradient-to-r from-blue-500/8 to-transparent p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-500/10">
                            <Bell size={16} className="text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Flux d'alertes</h3>
                          <p className="mt-0.5 text-[11px] text-slate-400">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {notifPermission !== 'granted' && (
                            <button 
                                onClick={handleRequestPermission}
                                className="rounded-lg p-2 text-rose-400 transition-all hover:bg-rose-500/10"
                                title="Activer les notifications Windows"
                                aria-label="Activer les notifications Windows"
                            >
                                <Zap size={14} />
                            </button>
                        )}
                            <button 
                            onClick={handleMarkAllAsRead}
                            className="rounded-lg p-2 text-blue-300 transition-all hover:bg-blue-400/10"
                            title="Tout marquer comme lu"
                            aria-label="Tout marquer comme lu"
                        >
                            <CheckCircle2 size={16} />
                        </button>
                        <button 
                            onClick={handleClearAll}
                            className="p-2 text-slate-500 transition-colors hover:text-white"
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
                  <div className="flex items-center gap-1 rounded-xl border border-white/6 bg-black/20 p-1">
                      {[
                        { id: 'all', label: 'Toutes', count: bufferedNotifs.length },
                        { id: 'approval', label: 'Missions', count: bufferedNotifs.filter(n => n.type === 'approval' || n.type === 'rejection').length },
                        { id: 'system', label: 'Système', count: bufferedNotifs.filter(n => n.type === 'system').length }
                      ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveFilter(tab.id as any)}
                            className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-all ${
                                activeFilter === tab.id ? 'bg-blue-500/90 text-white shadow-[0_8px_20px_rgba(59,130,246,0.35)]' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                              {tab.label}
                              <span className="ml-1 text-white/70">({tab.count})</span>
                          </button>
                      ))}
                  </div>
                </div>

                {/* Scroll Area */}
                <div className="custom-scrollbar flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
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
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                      <Bell size={44} className="mb-4 text-slate-500" />
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aucune alerte récente</p>
                    </div>
                  )}
                </div>

                {/* Gradient Fade Effect (UX Polish) */}
                <div className="pointer-events-none absolute bottom-20 left-0 right-0 h-8 bg-gradient-to-t from-slate-950 to-transparent" />

                {/* Footer */}
                <div className="shrink-0 border-t border-white/6 bg-black/20 p-4">
                  <button 
                    title="Accéder à l'archive complète de vos notifications depuis le début de la mission"
                    aria-label="Voir tout l'historique des notifications"
                    onClick={() => {
                        setIsOpen(false);
                        navigate('/admin/alerts');
                    }}
                    className="w-full rounded-xl border border-white/8 bg-white/[0.04] py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300 transition-all hover:border-white/12 hover:bg-white/[0.08] hover:text-white"
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
