import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Plus, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

type GedUser = {
  id: string;
  name: string;
  phone: string;
  phoneActivated: boolean;
  active: boolean;
  createdAt: string;
};

const GedcollectUserManager: React.FC = () => {
  const [users, setUsers] = useState<GedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/api/gedcollect-admin/users');
      setUsers(data.users || []);
    } catch {
      toast.error('Erreur chargement utilisateurs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSubmit = async () => {
    if (!phone || phone.length < 8) {
      toast.error('Numéro de téléphone invalide');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/api/gedcollect-admin/users', { phone, name: name || undefined });
      toast.success(`Utilisateur ${phone} ajouté et activé`);
      setShowForm(false);
      setPhone('');
      setName('');
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur création');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActivation = async (userId: string, activated: boolean) => {
    try {
      await apiClient.post('/api/gedcollect-admin/users/toggle-activation', { userId, activated });
      fetchUsers();
    } catch {
      toast.error('Erreur mise à jour');
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4 lg:col-span-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">
            GedCollect - Utilisateurs mobiles
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Gérez les numéros de téléphone autorisés à se connecter via l'application GedCollect.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100 transition hover:bg-blue-500/20"
        >
          <Smartphone size={14} />
          Ajouter un utilisateur
        </button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-100">
              Nouvel utilisateur mobile
            </p>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom (optionnel)"
              className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-400/40"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="Numéro téléphone"
              className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-400/40"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-500/20 px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-blue-100 transition hover:bg-blue-500/30 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <Smartphone size={28} className="mx-auto mb-2 text-slate-600" />
            <p className="text-xs font-semibold text-slate-500">
              Aucun utilisateur mobile. Ajoutez-en un avec le bouton ci-dessus.
            </p>
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/30 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{u.name}</p>
                <p className="text-xs font-semibold text-slate-400">{u.phone}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${
                    u.phoneActivated
                      ? 'bg-emerald-400/10 text-emerald-100'
                      : 'bg-slate-400/10 text-slate-400'
                  }`}
                >
                  {u.phoneActivated ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                  {u.phoneActivated ? 'Activé' : 'Désactivé'}
                </span>
                <button
                  type="button"
                  onClick={() => toggleActivation(u.id, !u.phoneActivated)}
                  className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] transition ${
                    u.phoneActivated
                      ? 'bg-red-500/10 text-red-100 hover:bg-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                  }`}
                >
                  {u.phoneActivated ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GedcollectUserManager;
