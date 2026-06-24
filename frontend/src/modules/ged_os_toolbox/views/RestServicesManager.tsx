import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, Loader2, Edit3, Trash2, Play } from 'lucide-react';
import apiClient from '@/api/client';
import toast from 'react-hot-toast';

type Hook = {
  id: string;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  active: boolean;
  formKey: string;
  lastTriggeredAt: string | null;
  lastStatus: number | null;
  createdAt: string;
};

type Props = {
  formKey: string;
};

const METHODS = ['POST', 'PUT', 'PATCH'];

const RestServicesManager: React.FC<Props> = ({ formKey }) => {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [headersText, setHeadersText] = useState('');

  const fetchHooks = useCallback(async () => {
    if (!formKey) return;
    try {
      const { data } = await apiClient.get(`toolbox/hooks?formKey=${encodeURIComponent(formKey)}`);
      setHooks(data.hooks || []);
    } catch {
      toast.error('Erreur chargement webhooks');
    } finally {
      setLoading(false);
    }
  }, [formKey]);

  useEffect(() => {
    if (formKey) {
      fetchHooks();
    }
  }, [formKey, fetchHooks]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setUrl('');
    setMethod('POST');
    setHeadersText('');
  };

  const openEdit = (hook: Hook) => {
    setEditingId(hook.id);
    setName(hook.name);
    setUrl(hook.url);
    setMethod(hook.method);
    setHeadersText(typeof hook.headers === 'object' && hook.headers ? JSON.stringify(hook.headers, null, 2) : '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) {
      toast.error('Nom et URL requis');
      return;
    }
    setSubmitting(true);
    try {
      let parsedHeaders: Record<string, string> = {};
      if (headersText.trim()) {
        try {
          parsedHeaders = JSON.parse(headersText);
          if (typeof parsedHeaders !== 'object' || Array.isArray(parsedHeaders)) throw new Error();
        } catch {
          toast.error('Headers : JSON objet invalide');
          setSubmitting(false);
          return;
        }
      }

      const body = { formKey, name: name.trim(), url: url.trim(), method, headers: parsedHeaders };

      if (editingId) {
        await apiClient.patch(`toolbox/hooks/${editingId}`, body);
        toast.success('Webhook modifié');
      } else {
        await apiClient.post('toolbox/hooks', body);
        toast.success('Webhook ajouté');
      }
      resetForm();
      fetchHooks();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur sauvegarde webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce webhook ?')) return;
    try {
      await apiClient.delete(`toolbox/hooks/${id}`);
      toast.success('Webhook supprimé');
      fetchHooks();
    } catch {
      toast.error('Erreur suppression');
    }
  };

  const handleToggleActive = async (hook: Hook) => {
    try {
      await apiClient.patch(`toolbox/hooks/${hook.id}`, { active: !hook.active });
      fetchHooks();
    } catch {
      toast.error('Erreur mise à jour');
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const { data } = await apiClient.post(`toolbox/hooks/${id}/test`);
      if (data.success) {
        toast.success(`Test OK (${data.status})`);
      } else {
        toast.error(`Test échec (${data.status}) : ${data.body || 'erreur'}`);
      }
      fetchHooks();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur test');
    } finally {
      setTestingId(null);
    }
  };

  if (!formKey) return null;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4 lg:col-span-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">
            Services REST (Webhooks)
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Envoyez automatiquement les donnees vers des serveurs externes lors de chaque soumission.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100 transition hover:bg-blue-500/20"
        >
          <Plus size={14} />
          Ajouter un service
        </button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Nom</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Slack notification"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white placeholder:text-slate-600 focus:border-blue-400/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Methode</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white focus:border-blue-400/40 focus:outline-none"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemple.com/api/webhook"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white placeholder:text-slate-600 focus:border-blue-400/40 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                Headers (JSON optionnel)
              </label>
              <textarea
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                placeholder='{ "Authorization": "Bearer xxx" }'
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs font-bold text-white placeholder:text-slate-600 focus:border-blue-400/40 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Modifier' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-400 hover:text-white transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : hooks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs font-semibold text-slate-500">
            Aucun webhook configure pour ce formulaire.
          </div>
        ) : (
          hooks.map((hook) => (
            <div
              key={hook.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/30 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{hook.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${
                    hook.active
                      ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                      : 'border-slate-600/30 bg-slate-700/20 text-slate-500'
                  }`}>
                    {hook.active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-400">{hook.method}</span>
                  <span className="truncate max-w-[300px]">{hook.url}</span>
                  {hook.lastTriggeredAt && (
                    <span className="text-slate-600">
                      Dernier: {hook.lastStatus === 0 ? 'Echec' : hook.lastStatus}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleActive(hook)}
                  title={hook.active ? 'Desactiver' : 'Activer'}
                  className={`grid h-8 w-8 place-items-center rounded-lg border transition ${
                    hook.active
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'border-slate-600/20 bg-slate-700/10 text-slate-500 hover:bg-slate-700/20'
                  }`}
                >
                  <CheckCircle size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleTest(hook.id)}
                  disabled={testingId === hook.id}
                  title="Tester"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 transition hover:bg-blue-500/20"
                >
                  {testingId === hook.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(hook)}
                  title="Modifier"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition hover:text-white"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(hook.id)}
                  title="Supprimer"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 transition hover:bg-rose-500/20"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RestServicesManager;
