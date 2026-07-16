/**
 * Prestataires.tsx
 * Standalone CRUD module for managing prestataires (partner companies).
 * Fetches from /carto-grappes/prestataires via apiClient.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  Filter,
  X,
  Save,
  Loader2,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '@/api/client';
import { useProject } from '@contexts/ProjectContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Prestataire {
  id: number;
  organizationId: string;
  nom?: string;
  entreprise?: string;
  societe?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  lot?: string;
  region?: string;
  representantLegal?: string;
  nrc?: string;
  ifu?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PrestataireForm {
  nom: string;
  entreprise: string;
  societe: string;
  telephone: string;
  email: string;
  adresse: string;
  lot: string;
  region: string;
  representantLegal: string;
  nrc: string;
  ifu: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_PATH = '/carto-grappes/prestataires';

const EMPTY_FORM: PrestataireForm = {
  nom: '',
  entreprise: '',
  societe: '',
  telephone: '',
  email: '',
  adresse: '',
  lot: '',
  region: '',
  representantLegal: '',
  nrc: '',
  ifu: '',
};

const LOT_OPTIONS = ['A', 'B', 'C'];
const REGION_OPTIONS = ['Kaffrine', 'Tambacounda'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Prestataires: React.FC = () => {
  const { project } = useProject();

  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Prestataire | null>(null);
  const [form, setForm] = useState<PrestataireForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Prestataire | null>(null);

  /* --- Fetch --- */
  const fetchPrestataires = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get(API_PATH);
      const list: Prestataire[] = Array.isArray(data) ? data : (data.prestataires ?? []);
      setPrestataires(list);
    } catch {
      toast.error('Erreur lors du chargement des prestataires');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrestataires();
  }, [fetchPrestataires]);

  /* --- Filtering --- */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prestataires.filter((p) => {
      if (lotFilter && p.lot !== lotFilter) return false;
      if (regionFilter && p.region !== regionFilter) return false;
      if (q) {
        const haystack = `${p.nom ?? ''} ${p.entreprise ?? ''} ${p.societe ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [prestataires, search, lotFilter, regionFilter]);

  /* --- Modal handlers --- */
  const openAdd = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((p: Prestataire) => {
    setEditing(p);
    setForm({
      nom: p.nom ?? '',
      entreprise: p.entreprise ?? '',
      societe: p.societe ?? '',
      telephone: p.telephone ?? '',
      email: p.email ?? '',
      adresse: p.adresse ?? '',
      lot: p.lot ?? '',
      region: p.region ?? '',
      representantLegal: p.representantLegal ?? '',
      nrc: p.nrc ?? '',
      ifu: p.ifu ?? '',
    });
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }, []);

  const updateField = useCallback((key: keyof PrestataireForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* --- Submit --- */
  const handleSubmit = useCallback(async () => {
    if (!form.entreprise.trim() && !form.nom.trim()) {
      toast.error('Le nom ou l\u2019entreprise est requis');
      return;
    }
    try {
      setSubmitting(true);
      if (editing?.id) {
        await apiClient.put(`${API_PATH}/${editing.id}`, form);
        toast.success('Prestataire modifi\u00e9');
      } else {
        await apiClient.post(API_PATH, form);
        toast.success('Prestataire cr\u00e9\u00e9');
      }
      await fetchPrestataires();
      closeModal();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Erreur lors de l\u2019enregistrement');
    } finally {
      setSubmitting(false);
    }
  }, [form, editing, fetchPrestataires, closeModal]);

  /* --- Delete --- */
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    try {
      await apiClient.delete(`${API_PATH}/${deleteTarget.id}`);
      toast.success('Prestataire supprim\u00e9');
      await fetchPrestataires();
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchPrestataires]);

  /* --- Lot badge colours --- */
  const lotBadge = (lot?: string) => {
    const map: Record<string, string> = {
      A: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      B: 'bg-amber-100 text-amber-700 border-amber-200',
      C: 'bg-rose-100 text-rose-700 border-rose-200',
    };
    return map[lot ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-6">
      {/* -- Header -- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-indigo-600" />
            {'Prestataires'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {project?.name
              ? `Gestion des prestataires \u2014 ${project.name}`
              : 'Gestion des prestataires et entreprises partenaires'}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {'Nouveau prestataire'}
        </button>
      </div>

      {/* -- Filters -- */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou entreprise\u2026"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={lotFilter}
            onChange={(e) => setLotFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            <option value="">{'Tous les lots'}</option>
            {LOT_OPTIONS.map((l) => (
              <option key={l} value={l}>{`Lot ${l}`}</option>
            ))}
          </select>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            <option value="">{'Toutes les r\u00e9gions'}</option>
            {REGION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* -- Table -- */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {'Chargement\u2026'}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Building2 className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium">{'Aucun prestataire trouv\u00e9'}</p>
            <p className="mt-1 text-xs">
              {search || lotFilter || regionFilter
                ? 'Essayez de modifier vos filtres'
                : 'Cliquez sur \u00ab Nouveau prestataire \u00bb pour commencer'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">{'Nom'}</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    {'Entreprise'}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    {'T\u00e9l\u00e9phone'}
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">{'Lot'}</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">
                    {'R\u00e9gion'}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">{'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                          <User className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-slate-900">{p.nom || '\u2014'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.entreprise || '\u2014'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.telephone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {p.telephone}
                        </span>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.lot ? (
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${lotBadge(p.lot)}`}
                        >
                          {`Lot ${p.lot}`}
                        </span>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.region ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {p.region}
                        </span>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          title={'Modifier'}
                          className="rounded-md p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          title={'Supprimer'}
                          className="rounded-md p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* -- Row count -- */}
      {!loading && (
        <p className="text-xs text-slate-400 text-right">
          {`${filtered.length} prestataire${filtered.length > 1 ? 's' : ''} affich\u00e9${filtered.length > 1 ? 's' : ''}`}
        </p>
      )}

      {/* ============================================================== */}
      {/*  ADD / EDIT MODAL                                               */}
      {/* ============================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                {editing ? 'Modifier le prestataire' : 'Nouveau prestataire'}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4">
              {/* Row 1: Nom + Entreprise */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">{'Nom *'}</span>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => updateField('nom', e.target.value)}
                    placeholder="Nom du contact"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">{'Entreprise *'}</span>
                  <input
                    type="text"
                    value={form.entreprise}
                    onChange={(e) => updateField('entreprise', e.target.value)}
                    placeholder="Nom de l\u2019entreprise"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </label>
              </div>

              {/* Row 2: Societe + Telephone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">{'Soci\u00e9t\u00e9'}</span>
                  <input
                    type="text"
                    value={form.societe}
                    onChange={(e) => updateField('societe', e.target.value)}
                    placeholder="Raison sociale"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">
                    {'T\u00e9l\u00e9phone'}
                  </span>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      value={form.telephone}
                      onChange={(e) => updateField('telephone', e.target.value)}
                      placeholder="+221 77 000 00 00"
                      className="mt-1 w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </label>
              </div>

              {/* Row 3: Email + Adresse */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">{'Email'}</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="email@example.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">{'Adresse'}</span>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={form.adresse}
                      onChange={(e) => updateField('adresse', e.target.value)}
                      placeholder="Adresse"
                      className="mt-1 w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </label>
              </div>

              {/* Row 4: Lot + Region */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">{'Lot'}</span>
                  <select
                    value={form.lot}
                    onChange={(e) => updateField('lot', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">{'S\u00e9lectionner'}</option>
                    {LOT_OPTIONS.map((l) => (
                      <option key={l} value={l}>{`Lot ${l}`}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">{'R\u00e9gion'}</span>
                  <select
                    value={form.region}
                    onChange={(e) => updateField('region', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">{'S\u00e9lectionner'}</option>
                    {REGION_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Row 5: Representant + NRC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">
                    {'Repr\u00e9sentant l\u00e9gal'}
                  </span>
                  <input
                    type="text"
                    value={form.representantLegal}
                    onChange={(e) => updateField('representantLegal', e.target.value)}
                    placeholder="Nom du repr\u00e9sentant"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">
                    {'NRC (Num\u00e9ro Registre Commerce)'}
                  </span>
                  <input
                    type="text"
                    value={form.nrc}
                    onChange={(e) => updateField('nrc', e.target.value)}
                    placeholder="NRC"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </label>
              </div>

              {/* Row 6: IFU */}
              <label className="block">
                <span className="text-xs font-medium text-slate-600">
                  {'IFU (Identifiant Fiscal Unique)'}
                </span>
                <input
                  type="text"
                  value={form.ifu}
                  onChange={(e) => updateField('ifu', e.target.value)}
                  placeholder="IFU"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </label>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {'Annuler'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editing ? 'Enregistrer' : 'Cr\u00e9er'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/*  DELETE CONFIRMATION MODAL                                       */}
      {/* ============================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                {'Supprimer le prestataire ?'}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {'\u00cates-vous s\u00fbr de vouloir supprimer '}
                <span className="font-medium text-slate-700">
                  {deleteTarget.entreprise || deleteTarget.nom}
                </span>
                {' ? Cette action est irr\u00e9versible.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {'Annuler'}
              </button>
              <button
                onClick={confirmDelete}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(Prestataires);
