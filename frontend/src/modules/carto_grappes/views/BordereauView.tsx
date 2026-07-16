import React, { useMemo, useState, useCallback, useRef } from 'react';
import type { Menage, LotKey, StatusValue, EntrepreneurData, GpsEntry } from '../types';
import { STATUS_OPTIONS, STATUS_MAP, LOT_TITLES, LOT_KEYS } from '../constants';
import * as api from '../hooks/carto_grappes.service';

interface BordereauViewProps {
  menages: Menage[];
  selectedRegion: string;
  selectedGrappe: string | null;
  selectedLot: LotKey;
  onSelectLot: (lot: LotKey) => void;
  getEntry: (ordre: number) => {
    A: { status: StatusValue; justif: string; updatedAt: string | null };
    B: { status: StatusValue; justif: string; updatedAt: string | null };
    C: { status: StatusValue; justif: string; updatedAt: string | null };
    conforme: boolean;
    obs: string;
  };
  updateEntry: (ordre: number, lot: LotKey, status: StatusValue, justif: string) => void;
  updateConforme: (ordre: number, conforme: boolean) => void;
  updateObs: (ordre: number, obs: string) => void;
  searchQuery: string;
  getEntrepreneur: (lot: LotKey, region: string, grappe: number) => EntrepreneurData;
  archivedGrappes?: Set<string>;
  gps: GpsEntry;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return (
    <>
      {before}
      <mark className="bg-yellow-200">{match}</mark>
      {after}
    </>
  );
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const BordereauView: React.FC<BordereauViewProps> = React.memo(({
  menages, selectedRegion, selectedGrappe, selectedLot, onSelectLot,
  getEntry, updateEntry, updateConforme, updateObs,
  searchQuery, getEntrepreneur, archivedGrappes, gps,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [photoModal, setPhotoModal] = useState<{ ordre: number; lot: string } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [terrainModal, setTerrainModal] = useState<Menage | null>(null);
  const [terrainForm, setTerrainForm] = useState({
    nom: '', village: '', region: '', grappe: '',
    statusA: 'non_fait' as StatusValue,
    statusB: 'non_fait' as StatusValue,
    statusC: 'non_fait' as StatusValue,
    conforme: false,
    obs: '',
  });
  const [ficheModal, setFicheModal] = useState<Menage | null>(null);
  const [workflowMsg, setWorkflowMsg] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [advVillage, setAdvVillage] = useState('');
  const [advDateFrom, setAdvDateFrom] = useState('');
  const [advDateTo, setAdvDateTo] = useState('');
  const [visibleLots, setVisibleLots] = useState<LotKey[]>(['A', 'B', 'C']);
  const [justUpdated, setJustUpdated] = useState<Record<number, boolean>>({});

  const resetAdvFilters = useCallback(() => {
    setAdvVillage('');
    setAdvDateFrom('');
    setAdvDateTo('');
    setVisibleLots(['A', 'B', 'C']);
  }, []);

  const triggerBlink = useCallback((ordre: number) => {
    setJustUpdated(prev => ({ ...prev, [ordre]: true }));
    setTimeout(() => setJustUpdated(prev => ({ ...prev, [ordre]: false })), 800);
  }, []);

  const updateEntryWithBlink = useCallback((ordre: number, lot: LotKey, status: StatusValue, justif: string) => {
    updateEntry(ordre, lot, status, justif);
    triggerBlink(ordre);
  }, [updateEntry, triggerBlink]);

  const displayMenages = useMemo(() => {
    let result = menages;
    if (selectedRegion !== '__ALL__') result = result.filter(m => m.region === selectedRegion);
    if (selectedGrappe) {
      const [, grp] = selectedGrappe.split('_');
      result = result.filter(m => m.grappe === Number(grp));
    }
    if (filterStatus !== 'all') {
      result = result.filter(m => getEntry(m.ordre)[selectedLot].status === filterStatus);
    }
    if (advVillage.trim()) {
      const q = advVillage.toLowerCase();
      result = result.filter(m => m.village.toLowerCase().includes(q));
    }
    if (advDateFrom) {
      const from = new Date(advDateFrom).getTime();
      result = result.filter(m => {
        const entry = getEntry(m.ordre)[selectedLot];
        return entry.updatedAt ? new Date(entry.updatedAt).getTime() >= from : true;
      });
    }
    if (advDateTo) {
      const to = new Date(advDateTo).getTime() + 86400000;
      result = result.filter(m => {
        const entry = getEntry(m.ordre)[selectedLot];
        return entry.updatedAt ? new Date(entry.updatedAt).getTime() <= to : true;
      });
    }
    return result;
  }, [menages, selectedRegion, selectedGrappe, selectedLot, filterStatus, getEntry, advVillage, advDateFrom, advDateTo]);

  const stats = useMemo(() => {
    const total = displayMenages.length;
    const counts: Record<string, number> = {};
    for (const s of STATUS_OPTIONS) counts[s.value] = 0;
    for (const m of displayMenages) {
      const st = getEntry(m.ordre)[selectedLot].status;
      counts[st] = (counts[st] || 0) + 1;
    }
    return { total, counts };
  }, [displayMenages, selectedLot, getEntry]);

  const openPhoto = useCallback(async (ordre: number, lot: string) => {
    setPhotoModal({ ordre, lot });
    const photo = await api.fetchPhoto(ordre, lot);
    setPhotoUrl(photo?.data || null);
  }, []);

  const handlePhotoUpload = useCallback(async (ordre: number, lot: string, file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      setWorkflowMsg('❌ Fichier trop volumineux (max 3 Mo)');
      setTimeout(() => setWorkflowMsg(null), 3000);
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h / w) * maxDim); w = maxDim; }
          else { w = Math.round((w / h) * maxDim); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', 0.72);
          try {
            await api.savePhoto(ordre, lot, base64);
            setPhotoUrl(base64);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('QuotaExceededError') || msg.includes('quota')) {
              setWorkflowMsg('❌ Espace de stockage photo plein');
            } else {
              setWorkflowMsg('❌ Erreur sauvegarde photo');
            }
            setTimeout(() => setWorkflowMsg(null), 3000);
          }
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleWorkflowSubmit = useCallback(async (m: Menage) => {
    const entry = getEntry(m.ordre);
    try {
      await api.submitWorkflow({
        householdOrdre: m.ordre,
        nom: m.nom,
        village: m.village,
        region: m.region,
        grappe: String(m.grappe ?? ''),
        statuts: { A: entry.A, B: entry.B, C: entry.C },
      });
      setWorkflowMsg(`✅ #${m.ordre} soumis pour validation`);
      setTimeout(() => setWorkflowMsg(null), 3000);
    } catch {
      setWorkflowMsg(`❌ Échec soumission #${m.ordre}`);
      setTimeout(() => setWorkflowMsg(null), 3000);
    }
  }, [getEntry]);

  const openTerrain = useCallback((m: Menage) => {
    const entry = getEntry(m.ordre);
    setTerrainModal(m);
    setTerrainForm({
      nom: m.nom,
      village: m.village,
      region: m.region,
      grappe: String(m.grappe ?? ''),
      statusA: entry.A.status,
      statusB: entry.B.status,
      statusC: entry.C.status,
      conforme: entry.conforme,
      obs: entry.obs,
    });
  }, [getEntry]);

  const saveTerrain = useCallback(async () => {
    if (!terrainModal) return;
    await updateEntryWithBlink(terrainModal.ordre, 'A', terrainForm.statusA, '');
    await updateEntryWithBlink(terrainModal.ordre, 'B', terrainForm.statusB, '');
    await updateEntryWithBlink(terrainModal.ordre, 'C', terrainForm.statusC, '');
    await updateConforme(terrainModal.ordre, terrainForm.conforme);
    await updateObs(terrainModal.ordre, terrainForm.obs);
    setTerrainModal(null);
  }, [terrainModal, terrainForm, updateEntryWithBlink, updateConforme, updateObs]);

  const handlePrint = useCallback(async (m: Menage) => {
  const entry = getEntry(m.ordre);
  const g = gps[m.ordre];
  const grappe = m.grappe ?? 1;
  const ent = getEntrepreneur('B', m.region, grappe);

  let photoData: string | null = null;
  for (const lot of ['B', 'A', 'C'] as LotKey[]) {
    try {
      const photo = await api.fetchPhoto(m.ordre, lot);
      if (photo?.data) { photoData = photo.data; break; }
    } catch { /* ignore */ }
  }

  const gpsStr = g ? `${g[0].toFixed(5)}, ${g[1].toFixed(5)}` : 'Non disponible';
  const qrData = encodeURIComponent(`PROQUELEC|${m.ordre}|${m.nom}|${m.village}|${gpsStr}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`;

  function stBadge(lot: LotKey): string {
    const st = entry[lot].status;
    const lbl = STATUS_MAP[st]?.label || st;
    let c = '#aaa';
    if (st === 'fait') c = '#22863a';
    else if (st === 'en_cours') c = '#92400E';
    else if (st.startsWith('bloque_') || st === 'non_conforme') c = '#cb2431';
    else if (st === 'reporte') c = '#7c3aed';
    return `<div style="flex:1;border:1px solid #DCE3E8;border-radius:6px;padding:8px;text-align:center;">
      <div style="font-size:10px;color:#8A97A3;margin-bottom:3px;">LOT ${lot}</div>
      <div style="font-weight:700;color:${c};font-size:11.5px;">${lbl}</div>
      ${entry[lot].justif ? `<div style="font-size:9.5px;color:#8A97A3;margin-top:2px;font-style:italic;">${entry[lot].justif}</div>` : ''}
      ${entry[lot].updatedAt ? `<div style="font-size:9px;color:#ccc;margin-top:2px;">${entry[lot].updatedAt}</div>` : ''}
    </div>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiche N°${m.ordre}</title>
  <style>body{font-family:Calibri,Arial,sans-serif;margin:0;padding:20px;color:#1a2a3a;font-size:12.5px;}
  .header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #1E3A5F;padding-bottom:12px;margin-bottom:16px;}
  .lot-row{display:flex;gap:8px;margin-bottom:12px;}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
  .info-box{background:#F8FAFB;border-radius:6px;padding:8px 12px;}
  .info-box .lbl{font-size:10px;color:#8A97A3;margin-bottom:2px;}
  .info-box .val{font-weight:600;font-size:12.5px;}
  @media print{body{padding:10px;}@page{margin:1.2cm;size:A5;}}</style></head><body>
  <div class="header">
    <div style="width:14px;min-width:14px;height:60px;background:#1E3A5F;border-radius:4px;"></div>
    <div style="flex:1;">
      <div style="font-size:18px;font-weight:700;color:#1E3A5F;">${m.nom}</div>
      <div style="font-size:11px;color:#8A97A3;">Ménage N°${m.ordre} — ${m.village}, ${m.commune} — Grappe ${grappe} — ${m.region}</div>
      <div style="font-size:11px;color:#8A97A3;">Prestataire : ${ent.entreprise}</div>
    </div>
    <img src="${qrUrl}" style="width:90px;height:90px;" title="QR N°${m.ordre}">
  </div>
  <div class="info-grid">
    <div class="info-box"><div class="lbl">Téléphone</div><div class="val">${m.tel}</div></div>
    <div class="info-box"><div class="lbl">GPS</div><div class="val">${gpsStr}</div></div>
    <div class="info-box"><div class="lbl">Rang proximité</div><div class="val">${g ? 'Rang ' + g[2] : '—'}</div></div>
    <div class="info-box"><div class="lbl">Statut global</div><div class="val" style="color:${entry.conforme ? '#22863a' : '#E07A5F'}">${entry.conforme ? '✓ Conforme' : 'En cours'}</div></div>
  </div>
  <div class="lot-row">${stBadge('A')}${stBadge('B')}${stBadge('C')}</div>
  ${photoData ? `<div style="margin-bottom:12px;"><div style="font-size:10px;color:#8A97A3;margin-bottom:4px;">PHOTO</div><img src="${photoData}" style="max-width:100%;max-height:180px;border-radius:6px;object-fit:cover;"></div>` : ''}
  <div style="font-size:10px;color:#aaa;border-top:1px solid #DCE3E8;padding-top:8px;display:flex;justify-content:space-between;">
    <span>PROQUELEC</span>
    <span>Imprimé le ${new Date().toLocaleDateString('fr-FR')}</span>
  </div>
  <script>window.onload=function(){window.print()};<\/script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=520,height=740');
  if (win) { win.document.write(html); win.document.close(); }
}, [getEntry, gps, getEntrepreneur]);

  const exportCsv = useCallback(() => {
    const header = [
      'Ordre', 'Nom', 'Téléphone', 'Village', 'Région', 'Grappe',
      `Statut ${LOT_TITLES[selectedLot]}`,
      `Justif ${selectedLot}`, 'Conforme', 'Observations',
      'Entrepreneur',
    ];
    const rows = displayMenages.map(m => {
      const entry = getEntry(m.ordre);
      const lotEntry = entry[selectedLot];
      const ent = getEntrepreneur(selectedLot, m.region, m.grappe ?? 0);
      return [
        String(m.ordre),
        m.nom,
        m.tel,
        m.village,
        m.region,
        String(m.grappe ?? ''),
        STATUS_MAP[lotEntry.status]?.label ?? lotEntry.status,
        lotEntry.justif,
        entry.conforme ? 'Oui' : 'Non',
        entry.obs,
        ent?.entreprise || '',
      ].map(escapeCsvField).join(',');
    });
    const csv = '\uFEFF' + header.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const date = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `Bordereau_Lot${selectedLot}_${date}.csv`);
  }, [displayMenages, selectedLot, getEntry, getEntrepreneur]);

  const archivedSet = useMemo(() => archivedGrappes ?? new Set<string>(), [archivedGrappes]);

  return (
    <div className="flex flex-col h-full">
      <style>{`
        @keyframes carto-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.5; background-color: #dbeafe; } }
        .animate-blink { animation: carto-blink 0.8s ease-in-out 2; }
        @media print {
          .bordereau-toolbar, .bordereau-adv-filters { display: none !important; }
          table { font-size: 9px; }
          th, td { padding: 3px 4px; }
        }
      `}</style>
      {/* ── Toolbar ── */}
      <div className="bordereau-toolbar flex items-center gap-2 p-4 border-b border-slate-200 bg-white flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {LOT_KEYS.map(lot => (
            <button
              key={lot}
              onClick={() => onSelectLot(lot)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedLot === lot
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-white'
              }`}
            >
              {LOT_TITLES[lot]}
            </button>
          ))}
        </div>
<select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">Tous ({stats.total})</option>
                      {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value} style={{ color: '#1e293b' }}>{s.label} ({stats.counts[s.value] || 0})</option>
                      ))}
                    </select>
        <button
          onClick={exportCsv}
          className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          title="Exporter en CSV"
        >
          📥 CSV
        </button>
        <span className="text-xs text-slate-400 ml-auto">{displayMenages.length} ménages</span>
      </div>

      {/* ── Advanced Filters Bar ── */}
      <div className="bordereau-adv-filters flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] flex-wrap">
        <span className="font-semibold text-slate-700">Filtres :</span>
        <input
          type="text"
          value={advVillage}
          onChange={e => setAdvVillage(e.target.value)}
          placeholder="Village…"
          className="px-2 py-1 border border-slate-300 rounded-md text-[11px] w-28 text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={advDateFrom}
          onChange={e => setAdvDateFrom(e.target.value)}
          className="px-2 py-1 border border-slate-300 rounded-md text-[11px] text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-slate-400">→</span>
        <input
          type="date"
          value={advDateTo}
          onChange={e => setAdvDateTo(e.target.value)}
          className="px-2 py-1 border border-slate-300 rounded-md text-[11px] text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={resetAdvFilters} className="px-2 py-1 bg-slate-200 rounded-md text-[10px] font-semibold hover:bg-slate-300 text-slate-700">
          ✕ Réinitialiser
        </button>
        <span className="ml-auto text-slate-500">{displayMenages.length} résultats</span>
      </div>

      {/* ── Grappe sidebar summary ── */}
      {selectedGrappe && (() => {
        const [reg, grp] = selectedGrappe.split('_');
        const ent = getEntrepreneur(selectedLot, reg, Number(grp));
        const isArchived = archivedSet.has(selectedGrappe);
        return (
          <div className={`flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] ${isArchived ? 'opacity-55' : ''}`}>
            <span className="font-bold text-slate-700">Grappe {reg} #{grp}</span>
            {ent?.entreprise && ent.entreprise !== 'À définir' && (
              <span className="text-slate-500">
                👷 <span className="font-medium text-slate-600">{ent.entreprise}</span>
                {ent.telephone && <span className="ml-1 text-slate-400">({ent.telephone})</span>}
              </span>
            )}
            {isArchived && (
              <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">
                📦 Archivée
              </span>
            )}
          </div>
        );
      })()}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
              <th className="px-2 py-2.5 text-center font-semibold w-8">#</th>
              <th className="px-2 py-2.5 text-left font-semibold">Nom</th>
              <th className="px-2 py-2.5 text-left font-semibold">Tél</th>
              <th className="px-2 py-2.5 text-left font-semibold">Village</th>
              <th className="px-2 py-2.5 text-center font-semibold">G</th>
              <th className="px-2 py-2.5 text-center font-semibold">Statut</th>
              <th className="px-2 py-2.5 text-left font-semibold min-w-[140px]">Justification</th>
              <th className="px-2 py-2.5 text-center font-semibold w-10">✓</th>
              <th className="px-2 py-2.5 text-center font-semibold w-10" title="Photo">📸</th>
              <th className="px-2 py-2.5 text-center font-semibold w-10" title="Soumettre">🔁</th>
              <th className="px-2 py-2.5 text-center font-semibold w-10" title="Terrain">📋</th>
              <th className="px-2 py-2.5 text-center font-semibold w-10" title="Fiche">🖨</th>
            </tr>
          </thead>
          <tbody>
            {displayMenages.map((m, i) => {
              const entry = getEntry(m.ordre);
              const lotEntry = entry[selectedLot];
              const statusOpt = STATUS_MAP[lotEntry.status];
              const isArchived = archivedSet.has(`${m.region}_${m.grappe}`);
              return (
                <tr
                  key={m.ordre}
                  className={`border-b border-slate-100 transition-colors ${
                    isArchived ? 'opacity-55' : ''
                  } ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30 ${justUpdated[m.ordre] ? 'animate-blink' : ''}`}
                >
                  <td className="px-2 py-2 font-mono text-slate-500 text-center">{m.ordre}</td>
                  <td className="px-2 py-2 font-semibold text-slate-800">
                    {highlightText(m.nom, searchQuery)}
                  </td>
                  <td className="px-2 py-2 text-slate-600">{m.tel}</td>
                  <td className="px-2 py-2 text-slate-600">
                    {highlightText(m.village, searchQuery)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isArchived ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      G{m.grappe}{isArchived ? ' 📦' : ''}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <select
                      value={lotEntry.status}
                      onChange={e => updateEntryWithBlink(m.ordre, selectedLot, e.target.value as StatusValue, lotEntry.justif)}
                      className={`w-full min-w-[120px] px-2 py-1 rounded-md text-[11px] font-semibold border-0 cursor-pointer bg-slate-100 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none ${statusOpt?.cssClass || 'bg-gray-400'}`}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value} style={{ color: '#1e293b' }}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {statusOpt?.requiresJustif && (
                      <input
                        type="text"
                        value={lotEntry.justif}
                        onChange={e => updateEntryWithBlink(m.ordre, selectedLot, lotEntry.status, e.target.value)}
                        placeholder="Justif..."
                        className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={entry.conforme}
                      onChange={e => updateConforme(m.ordre, e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => openPhoto(m.ordre, selectedLot)}
                      className="text-slate-400 hover:text-blue-500 text-sm transition-colors"
                      title="Photo"
                    >
                      📸
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handleWorkflowSubmit(m)}
                      className="text-slate-400 hover:text-violet-500 text-sm transition-colors"
                      title="Soumettre pour validation"
                    >
                      🔁
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => openTerrain(m)}
                      className="text-slate-400 hover:text-amber-500 text-sm transition-colors"
                      title="Formulaire terrain"
                    >
                      📋
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => handlePrint(m)}
                      className="text-slate-400 hover:text-emerald-600 text-sm transition-colors"
                      title="Imprimer la fiche"
                    >
                      🖨
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {displayMenages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="text-4xl mb-3">📋</span>
            <span className="text-sm font-medium">Aucun ménage ne correspond aux filtres</span>
          </div>
        )}
      </div>

      {/* ── Workflow toast ── */}
      {workflowMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-lg animate-pulse">
          {workflowMsg}
        </div>
      )}

      {/* ── Hidden print ref ── */}
      <div ref={printRef} className="hidden" />

      {/* ── Photo modal ── */}
      {photoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setPhotoModal(null); setPhotoUrl(null); }}>
          <div className="bg-white rounded-xl p-5 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Photo — Ménage #{photoModal.ordre}</h3>
              <button onClick={() => { setPhotoModal(null); setPhotoUrl(null); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            {photoUrl ? (
              <img src={photoUrl} alt="Photo" className="w-full rounded-lg border border-slate-200" />
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">Aucune photo</div>
            )}
            <div className="mt-4 flex justify-center gap-3">
              <label className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
                {photoUrl ? 'Remplacer la photo' : 'Ajouter une photo'}
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(photoModal.ordre, photoModal.lot, file); }} />
              </label>
              {photoUrl && (
                <button
                  onClick={async () => {
                    if (!confirm('Supprimer cette photo ?')) return;
                    await api.savePhoto(photoModal.ordre, photoModal.lot, '');
                    setPhotoUrl(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  🗑 Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Terrain form modal ── */}
      {terrainModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setTerrainModal(null)}>
          <div className="bg-white rounded-xl p-5 max-w-md w-full max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Formulaire terrain — #{terrainModal.ordre}</h3>
              <button onClick={() => setTerrainModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nom</label>
                <input
                  type="text"
                  value={terrainForm.nom}
                  onChange={e => setTerrainForm(p => ({ ...p, nom: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Village</label>
                <input
                  type="text"
                  value={terrainForm.village}
                  onChange={e => setTerrainForm(p => ({ ...p, village: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Région</label>
                  <input
                    type="text"
                    value={terrainForm.region}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Grappe</label>
                  <input
                    type="text"
                    value={terrainForm.grappe}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-100 text-slate-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Statut Lot A</label>
                <select
                  value={terrainForm.statusA}
                  onChange={e => setTerrainForm(p => ({ ...p, statusA: e.target.value as StatusValue }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value} style={{ color: '#1e293b' }}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Statut Lot B</label>
                <select
                  value={terrainForm.statusB}
                  onChange={e => setTerrainForm(p => ({ ...p, statusB: e.target.value as StatusValue }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value} style={{ color: '#1e293b' }}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Statut Lot C</label>
                <select
                  value={terrainForm.statusC}
                  onChange={e => setTerrainForm(p => ({ ...p, statusC: e.target.value as StatusValue }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value} style={{ color: '#1e293b' }}>{s.label}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={terrainForm.conforme}
                  onChange={e => setTerrainForm(p => ({ ...p, conforme: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-2 focus:ring-green-500/20"
                />
                <span className="text-sm font-semibold text-slate-700">Conforme</span>
              </label>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Observations</label>
                <textarea
                  value={terrainForm.obs}
                  onChange={e => setTerrainForm(p => ({ ...p, obs: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setTerrainModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveTerrain}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Printable fiche modal ── */}
      {ficheModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setFicheModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Fiche Ménage #{ficheModal.ordre}</h3>
              <button onClick={() => setFicheModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="flex flex-col items-center gap-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PROQUELEC-${ficheModal.ordre}`}
                alt="QR Code"
                className="border border-slate-200 rounded-lg"
              />
              <div className="text-[11px] text-slate-500 text-center space-y-1">
                <p><span className="font-semibold">Nom :</span> {ficheModal.nom}</p>
                <p><span className="font-semibold">Village :</span> {ficheModal.village}</p>
                <p><span className="font-semibold">Région :</span> {ficheModal.region}</p>
                <p><span className="font-semibold">Grappe :</span> {ficheModal.grappe ?? ''}</p>
              </div>
              <button
                onClick={() => { setFicheModal(null); handlePrint(ficheModal); }}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                🖨 Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

BordereauView.displayName = 'BordereauView';
export default BordereauView;
