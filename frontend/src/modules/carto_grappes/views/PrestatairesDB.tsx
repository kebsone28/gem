/**
 * PrestatairesDB.tsx
 * Base de données locale des prestataires avec :
 *  - Tableau CRUD complet (ajouter, éditer, supprimer)
 *  - Import depuis fichier Excel (.xlsx), CSV ou JSON
 *  - Modèle de téléchargement Excel
 *  - Synchronisation avec le panneau d'affectation (via props)
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { Prestataire } from '../types';
import * as api from '../hooks/carto_grappes.service';

interface PrestatairesDBProps {
  prestataires: Prestataire[];
  onUpdate: (list: Prestataire[], skipApiSync?: boolean) => void;
  onImportExcel?: (rows: any[][]) => { added: number };
}

// ─── Colonnes attendues dans le fichier d'import ─────────────────────────────
const IMPORT_TEMPLATE_HEADERS = ['Nom Entreprise', 'Responsable', 'Téléphone', 'Email', 'Adresse', 'Représentant Légal', 'Fonction', 'NRC', 'IFU', 'Compte Bancaire', 'Forme Juridique'];

// ─── Composant ────────────────────────────────────────────────────────────────

const EMPTY_PRESTA: Omit<Prestataire, 'id'> = {
  nom: '', entreprise: '', societe: '', telephone: '', email: '', adresse: '',
  representantLegal: '', fonctionRepresentant: '', nrc: '', ifu: '', compteBancaire: '', formeJuridique: '',
};

const PrestatairesDB: React.FC<PrestatairesDBProps> = ({
  prestataires = [], onUpdate, onImportExcel,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<Prestataire, 'id'>>(EMPTY_PRESTA);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<Omit<Prestataire, 'id'>>(EMPTY_PRESTA);
  const [search, setSearch] = useState('');
  const [importStatus, setImportStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    prestataires.filter(p =>
      !search ||
      (p.entreprise || p.nom || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.societe || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.telephone || '').includes(search) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase())
    ),
    [prestataires, search],
  );

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    if (!addForm.entreprise?.trim() && !addForm.nom?.trim()) return;
    const newList: Prestataire[] = [
      ...prestataires,
      {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        ...addForm,
      },
    ];
    await onUpdate(newList);
    setAddForm(EMPTY_PRESTA);
    setIsAdding(false);
    setImportStatus({ msg: '✅ Prestataire ajouté et enregistré en base de données', ok: true });
  }, [addForm, prestataires, onUpdate]);

  const handleEdit = useCallback((p: Prestataire) => {
    setEditingId(p.id || null);
    setEditForm({
      nom: p.nom || '',
      entreprise: p.entreprise || p.nom || '',
      societe: p.societe || '',
      telephone: p.telephone || '',
      email: p.email || '',
      adresse: p.adresse || ''
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || (!editForm.entreprise?.trim() && !editForm.nom?.trim())) return;
    
    // Si l'ID est numérique, c'est un prestataire de la base de données → utiliser PUT API
    const isDbPrestataire = typeof editingId === 'number' || !isNaN(Number(editingId));
    if (isDbPrestataire) {
      try {
        await api.updatePrestataire(Number(editingId), {
          nom: editForm.nom || editForm.entreprise || '',
          entreprise: editForm.entreprise || editForm.nom || '',
          societe: editForm.societe || '',
          telephone: editForm.telephone || '',
          email: editForm.email || '',
          adresse: editForm.adresse || '',
          lot: editForm.lot || '',
          region: editForm.region || '',
        });
        setImportStatus({ msg: '✅ Modifications enregistrées en base de données', ok: true });
      } catch (err) {
        console.error('[handleSaveEdit] API update failed:', err);
        setImportStatus({ msg: '⚠️ Erreur de mise à jour en base (données locales conservées)', ok: false });
        return;
      }
    }
    
    // Mettre à jour localement (skipApiSync=true si déjà mis à jour via PUT)
    const newList = prestataires.map(p =>
      p.id === editingId ? { ...p, ...editForm } : p
    );
    await onUpdate(newList, isDbPrestataire);
    setEditingId(null);
    if (!isDbPrestataire) {
      setImportStatus({ msg: '✅ Modifications enregistrées localement', ok: true });
    }
  }, [editingId, editForm, prestataires, onUpdate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Supprimer ce prestataire de la base ?')) return;
    
    // Si l'ID est numérique, c'est un prestataire de la base de données → utiliser DELETE API
    const isDbPrestataire = typeof id === 'number' || !isNaN(Number(id));
    if (isDbPrestataire) {
      try {
        await api.deletePrestataire(Number(id));
        setImportStatus({ msg: '✅ Prestataire supprimé de la base de données', ok: true });
      } catch (err) {
        console.error('[handleDelete] API delete failed:', err);
        setImportStatus({ msg: '⚠️ Erreur de suppression en base (données locales conservées)', ok: false });
        return; // Ne pas supprimer localement si l'API échoue
      }
    }
    
    // Supprimer localement (skipApiSync=true pour éviter de resynchroniser toute la liste)
    const newList = prestataires.filter(p => p.id !== id);
    await onUpdate(newList, isDbPrestataire); // Passer true pour skip API sync si déjà supprimé via DELETE
    if (!isDbPrestataire) {
      setImportStatus({ msg: '✅ Prestataire supprimé localement', ok: true });
    }
  }, [prestataires, onUpdate]);

  // ── Import Excel/CSV ──────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setImportStatus(null);
    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          const newList = data.map((item: any) => ({
            id: item.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
            entreprise: item.entreprise || item.nom || item.company || '',
            societe: item.societe || item.société || '',
            telephone: item.telephone || item.téléphone || item.tel || '',
            email: item.email || item.mail || '',
            adresse: item.adresse || item.address || '',
          })).filter((p: Prestataire) => p.entreprise);
          const merged = [...prestataires];
          let added = 0;
          for (const np of newList) {
            const dupIdx = merged.findIndex(p => p.entreprise.toLowerCase() === np.entreprise.toLowerCase());
            if (dupIdx !== -1) { merged[dupIdx] = { ...merged[dupIdx], ...np, id: merged[dupIdx].id }; }
            else { merged.push(np); added++; }
          }
          await onUpdate(merged);
          setImportStatus({ msg: `✅ ${added} prestataires importés depuis JSON et enregistrés en base de données`, ok: true });
        }
      } else if (ext === 'csv') {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const rows = lines.map(l => l.split(/[;,]/).map(c => c.replace(/^"|"$/g, '').trim())).filter(Boolean);
        const result = onImportExcel(rows);
        setImportStatus({ msg: `✅ ${result.added} prestataires importés depuis CSV et enregistrés en base de données`, ok: true });
      } else {
        // Excel — try safeExcel (project standard, alias of 'xlsx'), fallback to real xlsx
        let rows: any[][];
        try {
          const { read: excelRead } = await import('/src/utils/safeExcel');
          const buffer = await file.arrayBuffer();
          const wb = await excelRead(buffer, { type: 'array' });

          if (!wb.SheetNames || wb.SheetNames.length === 0) {
            throw new Error('Le fichier Excel ne contient aucun onglet');
          }
          const sheetName = wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          if (!ws || !Array.isArray(ws.rows)) {
            throw new Error(`Onglet "${sheetName}" vide ou invalide`);
          }

          const raw = ws.rows.map(r =>
            Array.isArray(r) ? r.map(c => (c != null ? String(c) : '')) : [],
          );
          rows = raw.filter((r): r is any[] => Array.isArray(r) && r.some(c => c != null && c !== ''));
        } catch (safeErr) {
          // Fallback to real xlsx library (bypasses Vite alias by using full path)
          console.warn('[import] safeExcel failed, trying real xlsx:', (safeErr as Error).message);
          const XLSX = await import('/node_modules/xlsx/dist/xlsx.full.min.js');
          const buffer = await file.arrayBuffer();
          const wb = XLSX.read(buffer, { type: 'array' });

          if (!wb.SheetNames || wb.SheetNames.length === 0) {
            throw new Error('Le fichier Excel ne contient aucun onglet. Vérifiez que le fichier est bien au format .xlsx');
          }
          const sheetName = wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          if (!ws) {
            throw new Error(`Onglet "${sheetName}" introuvable dans le classeur`);
          }
          const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
          if (!Array.isArray(raw)) {
            throw new Error('Impossible de lire les données de l\'onglet');
          }
          rows = raw.filter((r): r is any[] => Array.isArray(r) && r.some(c => c != null && c !== ''));
        }

        if (rows.length < 2) {
          throw new Error('Le fichier doit contenir une ligne d\'en-tête et au moins une ligne de données');
        }
        const result = onImportExcel(rows);
        setImportStatus({ msg: `✅ ${result.added} prestataires importés depuis Excel et enregistrés en base de données`, ok: true });
      }
    } catch (err) {
      setImportStatus({ msg: `❌ Erreur lors de l'import : ${(err as Error).message}`, ok: false });
    }
    setTimeout(() => setImportStatus(null), 5000);
  }, [prestataires, onUpdate, onImportExcel]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Download template ─────────────────────────────────────────────────────
  const downloadTemplate = useCallback(async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      IMPORT_TEMPLATE_HEADERS,
      ['SARL Electrique Plus', 'Electrique Plus', '+221 77 123 45 67', 'contact@electplus.sn', 'Parcelles Assainies, Dakar'],
      ['BTP & Réseaux SARL', 'BTP Réseaux', '+221 33 456 78 90', 'btp@reseaux.sn', 'Kaffrine, Sénégal'],
    ]);
    ws['!cols'] = IMPORT_TEMPLATE_HEADERS.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Prestataires');
    XLSX.writeFile(wb, 'modele_prestataires.xlsx');
  }, []);

  // ── Export JSON ───────────────────────────────────────────────────────────
  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(prestataires, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'prestataires.json';
    a.click(); URL.revokeObjectURL(url);
  }, [prestataires]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm">🗄</span>
            Base de données Prestataires
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {prestataires.length} prestataires enregistrés — synchronisé avec le panneau d'affectation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            📄 Modèle Excel
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            💾 Export JSON
          </button>
          <button
            onClick={() => { setIsAdding(true); setAddForm(EMPTY_PRESTA); }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all shadow-sm"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {/* ── Import Zone ── */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-400 bg-indigo-50 scale-[1.01]'
              : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center justify-center gap-4">
            <div className="text-3xl">{isDragging ? '📂' : '📁'}</div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-700">
                {isDragging ? 'Lâchez pour importer' : 'Importer un fichier de prestataires'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Excel (.xlsx), CSV (.csv) ou JSON · Colonnes: Nom Entreprise, Responsable, Téléphone, Email, Adresse
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              {['xlsx', 'csv', 'json'].map(ext => (
                <span key={ext} className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase">{ext}</span>
              ))}
            </div>
          </div>
        </div>

        {importStatus && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold ${
            importStatus.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {importStatus.msg}
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div className="px-6 py-3 border-b border-slate-100">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un prestataire..."
            className="w-full pl-9 pr-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 focus:bg-white transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
          )}
        </div>
      </div>

      {/* ── Add Form (inline) ── */}
      {isAdding && (
        <div className="mx-6 my-4 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl">
          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span>✚</span> Nouveau prestataire
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {[
              { key: 'nom', label: 'Nom / Entreprise *', placeholder: 'Nom du prestataire', type: 'text' },
              { key: 'entreprise', label: 'Entreprise', placeholder: 'Nom de l\'entreprise', type: 'text' },
              { key: 'societe', label: 'Responsable', placeholder: 'Nom du responsable', type: 'text' },
              { key: 'telephone', label: 'Téléphone', placeholder: '+221 XX XXX XX XX', type: 'tel' },
              { key: 'email', label: 'Email', placeholder: 'email@exemple.com', type: 'email' },
              { key: 'adresse', label: 'Adresse', placeholder: 'Adresse complète', type: 'text' },
              { key: 'representantLegal', label: 'Représentant Légal', placeholder: 'Nom du représentant légal', type: 'text' },
              { key: 'fonctionRepresentant', label: 'Fonction Représentant', placeholder: 'Fonction du représentant', type: 'text' },
              { key: 'nrc', label: 'NRC', placeholder: 'Numéro Registre de Commerce', type: 'text' },
              { key: 'ifu', label: 'IFU', placeholder: 'Identifiant Fiscal Unique', type: 'text' },
              { key: 'compteBancaire', label: 'Compte Bancaire', placeholder: 'Numéro de compte bancaire', type: 'text' },
              { key: 'formeJuridique', label: 'Forme Juridique', placeholder: 'Forme juridique (SARL, SA, etc.)', type: 'text' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">{f.label}</label>
                <input
                  type={f.type}
                  value={(addForm as any)[f.key]}
                  onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 text-xs text-slate-800 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={!addForm.nom?.trim() && !addForm.entreprise?.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              ✓ Enregistrer
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="px-6 py-2 border-b border-slate-100 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="font-bold text-slate-700">{prestataires.length}</span> total
        </span>
        {prestataires.length > 0 && (
          <>
            <span className="w-px h-3 bg-slate-200" />
            <span className="flex items-center gap-1">
              <span className="font-bold text-indigo-600">{filtered.length}</span> affichés
            </span>
            <span className="w-px h-3 bg-slate-200" />
            <span className="flex items-center gap-1">
              <span className="font-bold text-emerald-600">{filtered.filter(p => p.telephone).length}</span> avec téléphone
            </span>
            <span className="w-px h-3 bg-slate-200" />
            <span className="flex items-center gap-1">
              <span className="font-bold text-amber-600">{filtered.filter(p => p.societe).length}</span> avec responsable
            </span>
          </>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto min-h-0 px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">🏢</div>
            <p className="text-sm font-semibold text-slate-500">
              {search ? 'Aucun prestataire ne correspond à votre recherche' : 'Aucun prestataire dans la base'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Effacez la recherche ou ajoutez un nouveau prestataire' : 'Importez un fichier Excel ou ajoutez des prestataires manuellement'}
            </p>
          </div>
        ) : (
          <table className="w-full text-xs mt-4">
            <thead>
              <tr className="bg-slate-50 rounded-xl">
                <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider rounded-l-xl">Nom / Entreprise</th>
                <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Représentant Légal</th>
                <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Téléphone</th>
                <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Email</th>
                <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider hidden xl:table-cell">NRC</th>
                <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider rounded-r-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                editingId === p.id ? (
                  // Edit inline row
                  <tr key={p.id} className="bg-indigo-50/50">
                    <td className="px-3 py-2" colSpan={6}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 mb-2">
                        {[
                          { key: 'nom', placeholder: 'Nom *', type: 'text' },
                          { key: 'entreprise', placeholder: 'Entreprise', type: 'text' },
                          { key: 'societe', placeholder: 'Responsable', type: 'text' },
                          { key: 'telephone', placeholder: 'Téléphone', type: 'tel' },
                          { key: 'email', placeholder: 'Email', type: 'email' },
                          { key: 'adresse', placeholder: 'Adresse', type: 'text' },
                          { key: 'representantLegal', placeholder: 'Représentant Légal', type: 'text' },
                          { key: 'fonctionRepresentant', placeholder: 'Fonction Représentant', type: 'text' },
                          { key: 'nrc', placeholder: 'NRC', type: 'text' },
                          { key: 'ifu', placeholder: 'IFU', type: 'text' },
                          { key: 'compteBancaire', placeholder: 'Compte Bancaire', type: 'text' },
                          { key: 'formeJuridique', placeholder: 'Forme Juridique', type: 'text' },
                        ].map(f => (
                          <input
                            key={f.key}
                            type={f.type}
                            value={(editForm as any)[f.key]}
                            onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            className="w-full px-2.5 py-1.5 text-xs text-slate-800 border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">✓ Sauvegarder</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {(p.nom || p.entreprise || 'P').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">{p.nom || p.entreprise || '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-500 hidden sm:table-cell">{p.representantLegal || '—'}</td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {p.telephone ? (
                        <a href={`tel:${p.telephone}`} className="text-blue-600 hover:text-blue-800 font-medium">{p.telephone}</a>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      {p.email ? (
                        <a href={`mailto:${p.email}`} className="text-blue-600 hover:text-blue-800">{p.email}</a>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-500 hidden xl:table-cell">{p.nrc || '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Modifier"
                        >✏️</button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Supprimer"
                        >🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

PrestatairesDB.displayName = 'PrestatairesDB';
export default PrestatairesDB;
