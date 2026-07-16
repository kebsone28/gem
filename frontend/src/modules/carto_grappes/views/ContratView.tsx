import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Menage, LotKey, EntrepreneurData, GanttItem } from '../types';
import { LOT_KEYS, LOT_TITLES, REGIONS } from '../constants';
import * as api from '../hooks/carto_grappes.service';
import { generateContratDocxRich } from '../engine/docxEngine';

interface ContratViewProps {
  menages: Menage[];
  getEntrepreneur: (lot: LotKey, region: string, grappe: number) => EntrepreneurData;
}

const DEFAULT_TEMPLATES: Record<LotKey, string> = {
  A: `CONTRAT DE PRESTATION — LOT A — PRÉ-CÂBLAGE

Entre les soussignés :

PROQUELEC SARL, CI 12, Rue Faidherbe, Dakar

Et : {entreprise}

Objet : Pré-câblage de {nbMenages} coffrets dans la grappe {grappe}, {region}

Montant : {montant} FCFA

Délai : {duree} jours à compter de la date de signature.`,
  B: `CONTRAT DE PRESTATION — LOT B — INSTALLATION INTÉRIEURE

Entre les soussignés :

PROQUELEC SARL, CI 12, Rue Faidherbe, Dakar

Et : {entreprise}

Objet : Installation intérieure de {nbMenages} ménages dans la grappe {grappe}, {region}

Montant : {montant} FCFA

Délai : {duree} jours à compter de la date de signature.`,
  C: `CONTRAT DE PRESTATION — LOT C — RACCORDEMENT

Entre les soussignés :

PROQUELEC SARL, CI 12, Rue Faidherbe, Dakar

Et : {entreprise}

Objet : Raccordement de {nbMenages} abonnés dans la grappe {grappe}, {region}

Montant : {montant} FCFA

Délai : {duree} jours à compter de la date de signature.`,
};

function getContractNum(lot: LotKey, region: string, grappe: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `PROQUELEC-LOT${lot}-${region}-${grappe}-${y}${m}${d}`;
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  let result = tpl;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, val);
  }
  return result;
}



const ContratView: React.FC<ContratViewProps> = React.memo(({ menages, getEntrepreneur }) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'generate'>('templates');
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [templateDirty, setTemplateDirty] = useState<Record<string, boolean>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState<LotKey | null>(null);

  const [selectedLot, setSelectedLot] = useState<LotKey>('A');
  const [selectedRegion, setSelectedRegion] = useState('Kaffrine');
  const [selectedGrappe, setSelectedGrappe] = useState(1);
  const [contratNum, setContratNum] = useState('');
  const [duree, setDuree] = useState('30');
  const [observations, setObservations] = useState('');
  const [ganttData, setGanttData] = useState<GanttItem[]>([]);
  const [loadingGantt, setLoadingGantt] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await api.fetchContractTemplates();
      setTemplates(data || {});
    } catch {
      setTemplates({});
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const loadGantt = useCallback(async () => {
    setLoadingGantt(true);
    try {
      const data = await api.fetchGantt();
      const mapped: GanttItem[] = (data || []).map(item => ({
        phase: item.phase,
        region: item.grappeKey ? item.grappeKey.split('_')[0] : '',
        debut: item.startDate ? new Date(item.startDate) : new Date(),
        fin: item.endDate ? new Date(item.endDate) : new Date(),
        color: '#3B82F6',
        detail: item.grappeKey || undefined,
      }));
      setGanttData(mapped);
    } catch {
      setGanttData([]);
    } finally {
      setLoadingGantt(false);
    }
  }, []);

  const currentTemplate = useMemo(() => {
    return templates[selectedLot] || DEFAULT_TEMPLATES[selectedLot];
  }, [templates, selectedLot]);

  const nbMenages = useMemo(() => {
    return menages.filter(m => m.region === selectedRegion && m.grappe === selectedGrappe).length;
  }, [menages, selectedRegion, selectedGrappe]);

  const entrepreneur = useMemo(() => {
    return getEntrepreneur(selectedLot, selectedRegion, selectedGrappe);
  }, [getEntrepreneur, selectedLot, selectedRegion, selectedGrappe]);

  const planningDates = useMemo(() => {
    return ganttData.filter(
      g => g.region === selectedRegion && g.detail?.includes(String(selectedGrappe)),
    );
  }, [ganttData, selectedRegion, selectedGrappe]);

  const autoContratNum = useMemo(() => {
    return getContractNum(selectedLot, selectedRegion, selectedGrappe);
  }, [selectedLot, selectedRegion, selectedGrappe]);

  const handleLotChange = useCallback((lot: LotKey) => {
    setSelectedLot(lot);
    if (!contratNum) setContratNum(getContractNum(lot, selectedRegion, selectedGrappe));
  }, [contratNum, selectedRegion, selectedGrappe]);

  const handleRegionChange = useCallback((region: string) => {
    setSelectedRegion(region);
    setSelectedGrappe(1);
  }, []);

  const updateTemplate = useCallback((lot: LotKey, value: string) => {
    setTemplates(prev => ({ ...prev, [lot]: value }));
    setTemplateDirty(prev => ({ ...prev, [lot]: true }));
  }, []);

  const saveTemplate = useCallback(async (lot: LotKey) => {
    setSavingTemplate(lot);
    try {
      await api.saveContractTemplate(lot, templates[lot] || '');
      setTemplateDirty(prev => ({ ...prev, [lot]: false }));
    } catch {
      alert('Erreur lors de la sauvegarde du template');
    } finally {
      setSavingTemplate(null);
    }
  }, [templates]);

  const handleApercu = useCallback(() => {
    const vars: Record<string, string> = {
      entreprise: entrepreneur.entreprise || entrepreneur.societe || 'N/A',
      region: selectedRegion,
      grappe: String(selectedGrappe),
      nbMenages: String(nbMenages),
      duree: duree || '30',
      montant: '---',
      contratNum: contratNum || autoContratNum,
      observations: observations || 'Néant',
    };
    const filled = fillTemplate(currentTemplate, vars);
    const htmlLines = filled.split('\n').map(line => {
      if (line.trim() === '') return '<br/>';
      return `<p style="margin:0 0 4px 0;font-size:11px;">${line}</p>`;
    }).join('');
    setPreviewHtml(`
      <div style="font-family:Arial,sans-serif;color:#222;padding:20px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="margin:0;font-size:16px;">PROQUELEC SARL</h2>
          <p style="margin:4px 0;font-size:10px;color:#666;">CI 12, Rue Faidherbe, Dakar</p>
          <hr style="border:none;border-top:1px solid #ccc;margin:12px 0;"/>
        </div>
        <div style="margin-bottom:12px;">
          <p style="margin:0 0 2px 0;font-size:10px;color:#666;">N° Contrat : ${contratNum || autoContratNum}</p>
          <p style="margin:0;font-size:10px;color:#666;">Date : ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
        ${htmlLines}
        <hr style="border:none;border-top:1px solid #ccc;margin:16px 0;"/>
        <div style="margin-top:20px;">
          <p style="font-size:10px;color:#666;">Observations : ${observations || 'Néant'}</p>
        </div>
        <div style="margin-top:30px;display:flex;justify-content:space-between;">
          <div style="text-align:center;">
            <p style="font-size:10px;color:#666;">Pour PROQUELEC</p>
            <p style="font-size:10px;font-weight:bold;margin-top:30px;">_________________</p>
          </div>
          <div style="text-align:center;">
            <p style="font-size:10px;color:#666;">Le prestataire</p>
            <p style="font-size:10px;font-weight:bold;margin-top:30px;">_________________</p>
          </div>
        </div>
      </div>
    `);
    setPreviewOpen(true);
  }, [entrepreneur, selectedRegion, selectedGrappe, nbMenages, duree, observations, contratNum, autoContratNum, currentTemplate]);

  const handleGenerate = useCallback(async () => {
    const num = contratNum || autoContratNum;
    const BAREME: Record<LotKey, number> = { A: 15000, B: 25000, C: 10000 };
    const blob = await generateContratDocxRich({
      lot: selectedLot,
      region: selectedRegion,
      grappe: selectedGrappe,
      entreprise: entrepreneur.entreprise || entrepreneur.societe || 'N/A',
      societe: entrepreneur.societe,
      telephone: entrepreneur.telephone,
      email: entrepreneur.email,
      adresse: entrepreneur.adresse,
      nbMenages,
      contratNumber: num,
      date: new Date().toISOString().split('T')[0],
      montant: (BAREME[selectedLot] * nbMenages).toLocaleString('fr-FR'),
    });
    const filename = `Contrat_Lot${selectedLot}_${selectedRegion}_G${selectedGrappe}.docx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedLot, selectedRegion, selectedGrappe, entrepreneur, nbMenages, contratNum, autoContratNum]);

  const handlePrint = useCallback(() => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Contrat PROQUELEC</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #222; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h2 { margin: 0; font-size: 16px; }
        .header p { margin: 4px 0; font-size: 10px; color: #666; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; }
        .footer div { text-align: center; }
        .footer .sig { margin-top: 30px; font-weight: bold; }
      </style>
    </head><body>${previewHtml}</body></html>`);
    w.document.close();
    w.print();
    w.close();
  }, [previewHtml]);

  React.useEffect(() => {
    loadTemplates();
    loadGantt();
  }, [loadTemplates, loadGantt]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-800">Contrats & Templates</h3>
        <p className="text-[11px] text-slate-400 mb-4">
          Gérez les templates de contrat par lot et générez les documents DOCX.
        </p>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-4">
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'templates'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'generate'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Générer Contrat
          </button>
        </div>

        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {LOT_KEYS.map(lot => (
                <button
                  key={lot}
                  onClick={() => {
                    setSelectedLot(lot);
                    if (!contratNum) setContratNum(getContractNum(lot, selectedRegion, selectedGrappe));
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedLot === lot
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {LOT_TITLES[lot]}
                </button>
              ))}
            </div>

            {loadingTemplates ? (
              <div className="text-xs text-slate-400 py-4">Chargement des templates...</div>
            ) : (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  Template HTML — {LOT_TITLES[selectedLot]}
                </label>
                <textarea
                  value={currentTemplate}
                  onChange={e => updateTemplate(selectedLot, e.target.value)}
                  rows={18}
                  className="w-full px-3 py-2 text-sm text-slate-800 font-mono border border-slate-300 rounded-lg bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => saveTemplate(selectedLot)}
                    disabled={!templateDirty[selectedLot] || savingTemplate === selectedLot}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                      templateDirty[selectedLot]
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {savingTemplate === selectedLot ? 'Sauvegarde...' : 'Sauvegarder le template'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Lot</label>
                <select
                  value={selectedLot}
                  onChange={e => handleLotChange(e.target.value as LotKey)}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {LOT_KEYS.map(l => (
                    <option key={l} value={l}>{LOT_TITLES[l]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Région</label>
                <select
                  value={selectedRegion}
                  onChange={e => handleRegionChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {REGIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Grappe</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={selectedGrappe}
                  onChange={e => setSelectedGrappe(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-700">Entrepreneur attribué</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase">Entreprise</span>
                  <p className="text-xs font-semibold text-slate-700">{entrepreneur.entreprise || '—'}</p>
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase">Responsable</span>
                  <p className="text-xs text-slate-600">{entrepreneur.societe || '—'}</p>
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase">Téléphone</span>
                  <p className="text-xs text-slate-600">{entrepreneur.telephone || '—'}</p>
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase">Email</span>
                  <p className="text-xs text-slate-600">{entrepreneur.email || '—'}</p>
                </div>
              </div>
              <div className="mt-1">
                <span className="text-[9px] font-semibold text-slate-400 uppercase">Adresse</span>
                <p className="text-xs text-slate-600">{entrepreneur.adresse || '—'}</p>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[9px] font-semibold text-slate-400 uppercase">Nombre de ménages</span>
                <p className="text-xs font-bold text-slate-700">{nbMenages}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">N° Contrat</label>
                <input
                  type="text"
                  value={contratNum}
                  onChange={e => setContratNum(e.target.value)}
                  placeholder={autoContratNum}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Durée (jours)</label>
                <input
                  type="number"
                  value={duree}
                  onChange={e => setDuree(e.target.value)}
                  min={1}
                  className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Montant (FCFA)</label>
                <input
                  type="text"
                  placeholder="---"
                  disabled
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg mt-0.5 bg-slate-50 text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase">Observations</label>
              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-700 mb-2">Dates planning (lecture seule)</h4>
              {loadingGantt ? (
                <p className="text-[10px] text-slate-400">Chargement...</p>
              ) : planningDates.length === 0 ? (
                <p className="text-[10px] text-slate-400">Aucune donnée planning pour cette grappe.</p>
              ) : (
                <div className="overflow-auto max-h-[200px]">
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600">
                        <th className="px-2 py-1 text-left font-semibold">Phase</th>
                        <th className="px-2 py-1 text-left font-semibold">Début</th>
                        <th className="px-2 py-1 text-left font-semibold">Fin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planningDates.map((g, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-2 py-1 text-slate-600">{g.phase}</td>
                          <td className="px-2 py-1 text-slate-600">{g.debut.toLocaleDateString('fr-FR')}</td>
                          <td className="px-2 py-1 text-slate-600">{g.fin.toLocaleDateString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleApercu}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Aperçu avant impression
              </button>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Générer le contrat DOCX
              </button>
            </div>
          </div>
        )}
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-[700px] w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
              <span className="text-sm font-bold text-slate-800">Aperçu du contrat</span>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Imprimer
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Fermer
                </button>
              </div>
            </div>
            <div
              className="p-6 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

ContratView.displayName = 'ContratView';
export default ContratView;
