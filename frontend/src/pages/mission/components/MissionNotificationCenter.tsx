 
import React, { useState } from 'react';
import { Bell, Trash2, CheckCircle2, XCircle, Clock, Archive, X, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { MissionNotification } from '../../../store/db';
import * as notificationService from '../../../services/notificationService';

interface MissionNotificationCenterProps {
  onClose: () => void;
  projectId?: string;
}

export const MissionNotificationCenter: React.FC<MissionNotificationCenterProps> = ({
  onClose,
  projectId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const notifications =
    useLiveQuery(() => notificationService.getNotifications(projectId), [projectId]) || [];

  const filteredNotifications = notifications.filter(
    (n: MissionNotification) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationService.deleteNotification(id);
  };

  const handleMarkAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Bell className="text-indigo-500" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
                Centre d'Alertes
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                {notifications.length} Messages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Fermer"
            className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Rechercher une notification..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:ring-2 ring-indigo-500/20 outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
              <Archive size={48} className="mb-4 text-slate-300" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Aucun message archivé
              </p>
            </div>
          ) : (
            filteredNotifications.map((n: MissionNotification) => (
              <div
                key={n.id}
                onClick={() => handleMarkAsRead(n.id)}
                className={`group relative p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-lg ${n.read ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/5' : 'bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-100 dark:border-indigo-500/20'}`}
              >
                <div className="flex gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.type === 'approval' ? 'bg-emerald-500/10' : n.type === 'rejection' ? 'bg-rose-500/10' : 'bg-slate-500/10'}`}
                  >
                    {n.type === 'approval' ? (
                      <CheckCircle2 className="text-emerald-500" size={18} />
                    ) : n.type === 'rejection' ? (
                      <XCircle className="text-rose-500" size={18} />
                    ) : (
                      <Clock className="text-slate-500" size={18} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                        {n.title}
                      </h4>
                      <span className="text-[9px] font-bold text-slate-400">
                        {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                      {n.message}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[8px] font-black bg-slate-100 dark:bg-white/10 text-slate-500 px-2 py-0.5 rounded uppercase tracking-tighter">
                        De: {n.sender}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions on Hover */}
                <button
                  onClick={(e) => handleDelete(n.id, e)}
                  title="Supprimer"
                  className="absolute top-2 right-2 p-2 bg-white dark:bg-slate-800 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg shadow-xl border border-rose-100 dark:border-rose-500/20 hover:scale-110"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-white/10">
          <button
            onClick={() => notificationService.clearAllNotifications()}
            className="w-full py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-rose-500 transition-colors"
          >
            Tout Effacer
          </button>
        </div>
      </div>
    </div>
  );
};
