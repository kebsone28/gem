import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { REGIONS, GRAPPE_COLORS, PLANNING_DEFAULTS, PHASE_KEYS, PHASE_LABELS } from '../constants';
import type { PlanningParams, PlanningSubTab, PlanningResult, PlanningConfiguration, OptimizationOptions } from '../types';
import { computePlanning, fmtDate, addDaysStr, detectSenegalHolidays } from '../engine/planningEngine';
import { optimizePlanning, suggestBestPlanningConfiguration } from '../engine/planningOptimization';
import * as api from '../hooks/carto_grappes.service';
import { generatePlanningPDF } from '../utils/pdfGenerator';

interface PlanningViewProps {
  menageCounts?: Record<string, number>;
}

const GANTT_PHASES = [
  { label: 'Formation', color: '#667eea' },
  { label: 'Préparation kits', color: '#F2CC8F' },
  { label: 'Maçonnerie', color: '#9C6644' },
  { label: 'Transport', color: '#D4A03C' },
  { label: 'Installation intérieure', color: '#2E86AB' },
  { label: 'Réseau BT', color: '#1E3A5F' },
  { label: 'Contrôle qualité', color: '#22863a' },
  { label: 'Réception', color: '#6D597A' },
];

const WIZARD_STEPS = [
  { title: 'Dates clés', desc: 'Date de début et date limite du projet' },
  { title: 'Formation', desc: 'Durée, formateurs, pause et mode de formation' },
  { title: 'Maçonnerie', desc: 'Effectifs maçons (auto ou manuel)' },
  { title: 'Installation', desc: 'Effectifs installation' },
  { title: 'Réseau BT', desc: 'Effectifs réseau' },
  { title: 'Calendrier', desc: 'Jours fériés, événements religieux, saison des pluies' },
  { title: 'Optimisation IA', desc: 'Laissez l\'IA optimiser votre configuration' },
];

const PlanningView: React.FC<PlanningViewProps> = React.memo(({ menageCounts: externalCounts }) => {
  const [params, setParams] = useState<PlanningParams>(PLANNING_DEFAULTS as PlanningParams);
  const [activeTab, setActiveTab] = useState<PlanningSubTab>('synthese');
  const [saving, setSaving] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const ganttRef = useRef<HTMLDivElement>(null);
  
  // Optimization state
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedConfigurations, setOptimizedConfigurations] = useState<PlanningConfiguration[]>([]);
  const [selectedConfiguration, setSelectedConfiguration] = useState<PlanningConfiguration | null>(null);
  const [optimizationOptions, setOptimizationOptions] = useState<OptimizationOptions>({
    targetDurationMonths: 2,
    maxCostMultiplier: 1.5,
    optimizeFor: 'balanced',
  });

  const menageCounts = useMemo(() => {
    if (externalCounts && Object.keys(externalCounts).length > 0) return externalCounts;
    const counts: Record<string, number> = {};
    for (const r of REGIONS) counts[r] = r === 'Kaffrine' ? 2185 : 1351;
    return counts;
  }, [externalCounts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await api.fetchPlanningParams();
        if (!cancelled && p && typeof p === 'object' && Object.keys(p).length > 0) {
          setParams({ ...PLANNING_DEFAULTS, ...p } as PlanningParams);
        }
      } catch { /* use defaults */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const result = useMemo<PlanningResult>(() =>
    computePlanning(params, menageCounts),
    [params, menageCounts],
  );

  const updateParam = useCallback(async (key: string, value: unknown) => {
    const next = { ...params, [key]: value };
    setParams(next);
    setSaving(true);
    try { await api.savePlanningParams(next as Record<string, unknown>); } catch { /* ignore */ }
    setSaving(false);
  }, [params]);

  const updateWizardParam = useCallback((key: string, value: unknown) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  // Optimization functions
  const handleOptimizePlanning = async () => {
    setOptimizing(true);
    
    try {
      // Run optimization asynchronously with small delays to allow UI updates
      const optimized = await new Promise<PlanningConfiguration[]>((resolve) => {
        setTimeout(async () => {
          try {
            const result = await optimizePlanning(params, menageCounts, optimizationOptions);
            resolve(result);
          } catch (error) {
            console.error('Optimization error:', error);
            resolve([]);
          }
        }, 50);
      });
      
      setOptimizedConfigurations(optimized);
      
      if (optimized.length > 0) {
        // Auto-select the best configuration
        setSelectedConfiguration(optimized[0]);
      }
    } catch (error) {
      console.error('Optimization error:', error);
      alert('Erreur lors de l\'optimisation');
    } finally {
      setOptimizing(false);
    }
  };

  const handleSelectConfiguration = (config: PlanningConfiguration) => {
    setSelectedConfiguration(config);
    setParams(config.params);
  };

  const handleApplyOptimizedConfiguration = async () => {
    if (!selectedConfiguration) return;
    
    setParams(selectedConfiguration.params);
    setSaving(true);
    try {
      await api.savePlanningParams(selectedConfiguration.params as Record<string, unknown>);
      alert('Configuration optimisée appliquée avec succès !');
    } catch (error) {
      console.error('Error saving optimized configuration:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const applyWizardAndSave = useCallback(async () => {
    setSaving(true);
    try { await api.savePlanningParams(params as Record<string, unknown>); } catch { /* ignore */ }
    setSaving(false);
    setWizardOpen(false);
    setWizardStep(0);
  }, [params]);

  const resetDefaults = useCallback(async () => {
    if (!confirm('Remettre toutes les valeurs par défaut ?')) return;
    setParams(PLANNING_DEFAULTS as PlanningParams);
    setSaving(true);
    try { await api.savePlanningParams(PLANNING_DEFAULTS as Record<string, unknown>); } catch { /* ignore */ }
    setSaving(false);
  }, []);

  /* ── Export Excel ── */

  const exportExcel = useCallback(async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const date = new Date().toISOString().slice(0, 10);

    const synRows: unknown[][] = [
      ['PLANNING GLOBAL — PROQUELEC'],
      ['Généré le', new Date().toLocaleDateString('fr-FR')],
      [], ['SYNTHÈSE GÉNÉRALE'],
      ['Date début', params.dateDebut, 'Objectif', `${params.dureeObjectifMois} mois`],
      ['Durée estimée', `${result.synthese.dureeMois} mois`, 'Fin', fmtDate(result.synthese.finGlobal)],
      ['Élec. install', result.synthese.totalElecInstall, 'Élec. réseau', result.synthese.totalElecReseau],
      ['Surplus', result.synthese.surplus],
    ];
    if (result.alertes.length > 0) {
      synRows.push([], ['ALERTES']);
      result.alertes.forEach(a => synRows.push([a.sev === 'high' ? '⚠' : '⚡', a.region, a.msg]));
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(synRows), 'Synthèse');

    const formRows: unknown[][] = [['Région', 'Session', 'Début', 'Fin', 'Participants']];
    result.formation.forEach(f => formRows.push([f.region, f.session, fmtDate(f.debut), fmtDate(f.fin), f.participants]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(formRows), 'Formation');

    const planRows: unknown[][] = [['Phase', 'Région', 'Début', 'Fin', 'Jours', 'Équipes', 'Cadence']];
    result.gantt.forEach(g => planRows.push([g.phase, g.region, fmtDate(g.debut), fmtDate(g.fin),
      Math.ceil((g.fin.getTime() - g.debut.getTime()) / 86400000), '', g.detail || '']));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(planRows), 'Planning');

    const resRows: unknown[][] = [['Période', 'Élec. Install.', 'Élec. Réseau', 'Total Élec.', 'Maçons', 'Préparateurs', 'Transport', 'Contrôleurs']];
    const sy2 = result.synthese;
    for (let mois = 1; mois <= Math.ceil(sy2.dureeProjetMois) + 1; mois++) {
      const mDebut = addDaysStr(params.dateDebut || '2026-07-13', (mois - 1) * 30);
      const mFin = addDaysStr(params.dateDebut || '2026-07-13', mois * 30);
      let elecI = 0, elecR = 0, macons = 0, transport = 0, ctrl = 0;
      for (const [, r] of Object.entries(result.regions)) {
        if (mDebut < r.install.fin && mFin > r.install.debut) elecI += r.install.equipes * (params.installEffectifEquipe || 2);
        if (mDebut < r.reseau.fin && mFin > r.reseau.debut) elecR += r.reseau.equipes * (params.reseauEffectifEquipe || 2);
        if (mDebut < r.macon.fin && mFin > r.macon.debut) macons += r.macon.equipes;
        if (mDebut < r.transport.fin && mFin > r.transport.debut) transport += r.transport.equipes;
        if (mDebut < r.controle.fin && mFin > r.controle.debut) ctrl += r.controle.equipes;
      }
      if (elecI + elecR + macons + transport + ctrl === 0) continue;
      resRows.push([
        mDebut.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        elecI, elecR, elecI + elecR, macons,
        (params.preparateursKaffrine || 0) + (params.preparateursTamba || 0),
        transport, ctrl,
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resRows), 'Ressources');

    XLSX.writeFile(wb, `Planning_PROQUELEC_${date}.xlsx`);
  }, [params, result]);

  /* ── Download PDF with all Gantt charts ── */

  const downloadPDF = useCallback(async () => {
    setGeneratingPDF(true);
    try {
      await generatePlanningPDF(params, result, ganttRef.current);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setGeneratingPDF(false);
    }
  }, [params, result]);

  /* ── Sub-tab renderers ── */

  const renderSynthese = () => {
    const sy = result.synthese;
    const finOk = sy.dureeMois <= (params.dureeObjectifMois || 2) * 1.05;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Durée travaux', value: `${sy.dureeMois} mois`, color: finOk ? 'bg-emerald-500' : 'bg-red-500' },
            { label: 'Durée totale', value: `${sy.dureeProjetMois} mois`, color: 'bg-slate-600' },
            { label: 'Fin estimée', value: fmtDate(sy.finGlobal), color: 'bg-blue-600' },
            { label: 'Élec. installation', value: sy.totalElecInstall, color: 'bg-sky-600' },
            { label: 'Élec. réseau', value: sy.totalElecReseau, color: 'bg-indigo-600' },
            { label: 'Surplus élec.', value: `${sy.surplus >= 0 ? '+' : ''}${sy.surplus}`, color: sy.surplus >= 0 ? 'bg-emerald-500' : 'bg-red-500' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${kpi.color} rounded-l-xl`} />
              <div className="text-[10px] font-semibold text-slate-400 uppercase">{kpi.label}</div>
              <div className="text-lg font-black text-slate-800 mt-1">{kpi.value}</div>
            </div>
          ))}
        </div>

        {result.alertes.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <h4 className="text-xs font-bold text-slate-800">Alertes</h4>
              {result.alertes.filter(a => a.phase === '§19').length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 border border-red-300 text-red-700">
                  ⚠️ {result.alertes.filter(a => a.phase === '§19').length} anomalie(s) §19
                </span>
              )}
            </div>
            <div className="space-y-2">
              {result.alertes.map((a, i) => (
                <div key={i} className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  a.phase === '§19' ? 'bg-red-50 border border-red-300 text-red-700' :
                  a.sev === 'high' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'
                }`}>
                  <span className="font-bold">{a.region}</span> — {a.msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {result.alertes.length === 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-xs font-semibold text-emerald-700">
            Aucune alerte — le planning est dans les objectifs
          </div>
        )}
      </div>
    );
  };

  const renderParametres = () => {
    const sections = [
      { title: 'Général', keys: [
        { key: 'dateDebut', label: 'Date de début', type: 'date' },
        { key: 'dureeObjectifMois', label: 'Durée objectif (mois)', type: 'number' },
        { key: 'joursOuvresParMois', label: 'Jours ouvrés/mois', type: 'number' },
        { key: 'dateLimiteProjet', label: 'Date limite projet', type: 'date' },
      ]},
      { title: 'Effectifs', keys: [
        { key: 'elecKaffrine', label: 'Élec. Kaffrine', type: 'number' },
        { key: 'elecTamba', label: 'Élec. Tambacounda', type: 'number' },
        { key: 'maconsKaffrine', label: 'Maçons Kaffrine', type: 'number' },
        { key: 'maconsTamba', label: 'Maçons Tambacounda', type: 'number' },
        { key: 'controleursEquipesKaffrine', label: 'Contrôleurs Kaffrine', type: 'number' },
        { key: 'controleursEquipesTamba', label: 'Contrôleurs Tambacounda', type: 'number' },
        { key: 'preparateursKaffrine', label: 'Préparateurs Kaffrine', type: 'number' },
        { key: 'preparateursTamba', label: 'Préparateurs Tambacounda', type: 'number' },
      ]},
      { title: 'Maçonnerie', keys: [
        { key: 'maconCadenceJour', label: 'Murs/j/équipe', type: 'number' },
        { key: 'maconEffectifEquipe', label: 'Maçons/équipe', type: 'number' },
        { key: 'maconEquipesKaffrine', label: 'Équipes Kaffrine', type: 'number' },
        { key: 'maconEquipesTamba', label: 'Équipes Tambacounda', type: 'number' },
        { key: 'maconAvanceJours', label: 'Avance sur install (j)', type: 'number' },
      ]},
      { title: 'Installation', keys: [
        { key: 'installCadenceJour', label: 'Mén/j/équipe', type: 'number' },
        { key: 'installEffectifEquipe', label: 'Élec./équipe', type: 'number' },
        { key: 'installEquipesKaffrine', label: 'Équipes Kaffrine', type: 'number' },
        { key: 'installEquipesTamba', label: 'Équipes Tambacounda', type: 'number' },
      ]},
      { title: 'Réseau BT', keys: [
        { key: 'reseauCadenceJour', label: 'Mén/j/équipe', type: 'number' },
        { key: 'reseauEffectifEquipe', label: 'Élec./équipe', type: 'number' },
        { key: 'reseauEquipesKaffrine', label: 'Équipes Kaffrine', type: 'number' },
        { key: 'reseauEquipesTamba', label: 'Équipes Tambacounda', type: 'number' },
        { key: 'reseauPipelineDebut', label: 'Pipeline démarrage (%)', type: 'number' },
      ]},
      { title: 'Contrôle', keys: [
        { key: 'controleCadenceJour', label: 'Contrôles/j/agent', type: 'number' },
        { key: 'controleDebutPct', label: 'Début (% install)', type: 'number' },
        { key: 'receptionDelaiJours', label: 'Réception délai (j)', type: 'number' },
      ]},
      { title: 'Transport', keys: [
        { key: 'transportCadenceJour', label: 'Kits/j/véhicule', type: 'number' },
        { key: 'transportEquipesKaffrine', label: 'Véhicules Kaffrine', type: 'number' },
        { key: 'transportEquipesTamba', label: 'Véhicules Tambacounda', type: 'number' },
      ]},
      { title: 'Formation', keys: [
        { key: 'formationDureeJours', label: 'Durée session (j)', type: 'number' },
        { key: 'formationMaxPersonnes', label: 'Max/session', type: 'number' },
        { key: 'nbFormateurs', label: 'Nb formateurs', type: 'number' },
        { key: 'pauseEntreSessions', label: 'Pause entre sessions (j)', type: 'number' },
      ]},
      { title: 'Calendrier', keys: [
        { key: 'samediTravaille', label: 'Samedi travaillé', type: 'toggle' },
        { key: 'dimancheTravaille', label: 'Dimanche travaillé', type: 'toggle' },
        { key: 'compterJoursFeries', label: 'Jours fériés actifs', type: 'toggle' },
        { key: 'compterJoursReligieux', label: 'Événements religieux', type: 'toggle' },
        { key: 'compterSaisonPluie', label: 'Saison des pluies', type: 'toggle' },
        { key: 'impactPluie', label: 'Impact pluie (%)', type: 'number' },
      ]},
    ];

    const phaseStartModes = (params as Record<string, unknown>).phaseStartMode as Record<string, string> | undefined;

    const renderPhaseStartSection = () => (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-xs font-bold text-slate-800 mb-3">Dates de démarrage — Mode auto / manuel</h4>
        <p className="text-[10px] text-slate-500 mb-4">
          <b>Auto</b> = calculé automatiquement par le moteur. <b>Manuel</b> = date saisie utilisée comme point de départ de la phase.
        </p>
        <div className="space-y-3">
          {PHASE_KEYS.map(pk => {
            const mode = phaseStartModes?.[pk] ?? 'auto';
            const manualVal = (params.manualDates as Record<string, Record<string, string>> | undefined)?.[pk]?.Kaffrine ?? '';
            return (
              <div key={pk} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-t border-slate-100 first:border-0">
                <div className="w-40 font-semibold text-xs text-slate-700">{PHASE_LABELS[pk]}</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const next = { ...(phaseStartModes || {}), [pk]: 'auto' };
                      updateParam('phaseStartMode', next);
                    }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-l-lg border transition-all ${
                      mode === 'auto'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => {
                      const next = { ...(phaseStartModes || {}), [pk]: 'manual' };
                      updateParam('phaseStartMode', next);
                    }}
                    className={`px-3 py-1 text-[10px] font-bold rounded-r-lg border border-l-0 transition-all ${
                      mode === 'manual'
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    Manuel
                  </button>
                </div>
                {mode === 'manual' && (
                  <div className="flex gap-2 items-center">
                    {REGIONS.map(region => {
                      const dateVal = (params.manualDates as Record<string, Record<string, string>> | undefined)?.[pk]?.[region] ?? '';
                      return (
                        <div key={region} className="flex items-center gap-1">
                          <label className="text-[9px] text-slate-400 font-semibold">{region.slice(0, 4)}</label>
                          <input
                            type="date"
                            value={dateVal}
                            onChange={e => {
                              const currentManual = { ...(params.manualDates || {}) };
                              if (!currentManual[pk]) currentManual[pk] = {};
                              currentManual[pk][region] = e.target.value;
                              updateParam('manualDates', currentManual);
                            }}
                            className="w-[130px] px-2 py-1 text-[10px] text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.title} className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-xs font-bold text-slate-800 mb-3">{section.title}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {section.keys.map(k => (
                <div key={k.key}>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">{k.label}</label>
                  {k.type === 'toggle' ? (
                    <button
                      onClick={() => updateParam(k.key, !(params as Record<string, unknown>)[k.key])}
                      className={`mt-0.5 w-full px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        (params as Record<string, unknown>)[k.key]
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      {(params as Record<string, unknown>)[k.key] ? 'Oui' : 'Non'}
                    </button>
                  ) : (
                    <input
                      type={k.type}
                      value={String((params as Record<string, unknown>)[k.key] ?? '')}
                      onChange={e => updateParam(k.key, k.type === 'number' ? Number(e.target.value) : e.target.value)}
                      className="w-full mt-0.5 px-2.5 py-1.5 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {renderPhaseStartSection()}
        <div className="flex justify-end">
          <button onClick={resetDefaults} className="px-4 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
            Remettre les valeurs par défaut
          </button>
        </div>
      </div>
    );
  };

  const renderFormation = () => (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h4 className="text-xs font-bold text-slate-800 mb-3">Planning de Formation</h4>
      <div className="overflow-auto">
        <table className="w-full text-xs border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="px-3 py-2 text-left font-semibold">Région</th>
              <th className="px-3 py-2 text-center font-semibold">Session</th>
              <th className="px-3 py-2 text-center font-semibold">Date début</th>
              <th className="px-3 py-2 text-center font-semibold">Date fin</th>
              <th className="px-3 py-2 text-center font-semibold">Participants</th>
              <th className="px-3 py-2 text-center font-semibold">Durée</th>
            </tr>
          </thead>
          <tbody>
            {result.formation.map((f, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-3 py-2 font-semibold text-slate-700">{f.region}</td>
                <td className="px-3 py-2 text-center text-slate-600">Session {f.session}</td>
                <td className="px-3 py-2 text-center text-slate-600">{fmtDate(f.debut)}</td>
                <td className="px-3 py-2 text-center text-slate-600">{fmtDate(f.fin)}</td>
                <td className="px-3 py-2 text-center font-bold text-blue-600">{f.participants}</td>
                <td className="px-3 py-2 text-center text-slate-500">{params.formationDureeJours || 3} j</td>
              </tr>
            ))}
            {result.formation.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400 text-xs">Aucune session planifiée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPlanification = () => (
    <div className="space-y-4">
      {Object.entries(result.regions).map(([region, rd]) => (
        <div key={region} className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-xs font-bold text-slate-800 mb-3">{region} — {rd.menages} ménages</h4>
          <div className="overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="px-3 py-2 text-left font-semibold">Phase</th>
                  <th className="px-3 py-2 text-center font-semibold">Équipes</th>
                  <th className="px-3 py-2 text-center font-semibold">Cadence/j</th>
                  <th className="px-3 py-2 text-center font-semibold">Jours</th>
                  <th className="px-3 py-2 text-center font-semibold">Début</th>
                  <th className="px-3 py-2 text-center font-semibold">Fin</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Maçonnerie', ...rd.macon, color: '#9C6644', cad: `${rd.macon.equipes * (params.maconCadenceJour || 2)} murs/j` },
                  { label: 'Transport', ...rd.transport, color: '#D4A03C', cad: `${rd.transport.cadence || 0} kits/j` },
                  { label: 'Installation', ...rd.install, color: '#2E86AB', cad: `${rd.install.cadence || 0} mén/j` },
                  { label: 'Réseau BT', ...rd.reseau, color: '#1E3A5F', cad: `${rd.reseau.cadence || 0} mén/j` },
                  { label: 'Contrôle', ...rd.controle, color: '#22863a', cad: `${rd.controle.equipes * (params.controleCadenceJour || 15)} mén/j` },
                  { label: 'Réception', ...rd.reception, color: '#6D597A', cad: '-' },
                ].map((phase, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-700">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: phase.color }} />
                        {phase.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600">{phase.equipes}</td>
                    <td className="px-3 py-2 text-center text-slate-500 text-[10px]">{phase.cad}</td>
                    <td className="px-3 py-2 text-center text-slate-600">{phase.jours} j</td>
                    <td className="px-3 py-2 text-center text-slate-600">{fmtDate(phase.debut)}</td>
                    <td className="px-3 py-2 text-center text-slate-600">{fmtDate(phase.fin)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td className="px-3 py-2 text-blue-700">→ FIN RÉGION</td>
                  <td colSpan={4} />
                  <td className="px-3 py-2 text-center text-blue-700" colSpan={2}>{fmtDate(rd.finRegion)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );

  /* ── Gantt SVG ── */

  const renderGantt = () => {
    const allDates = result.gantt.flatMap(g => [g.debut, g.fin]);
    if (allDates.length === 0) return <div className="text-center text-slate-400 text-xs py-8">Aucune donnée Gantt</div>;

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    minDate.setDate(1);
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    maxDate.setMonth(maxDate.getMonth() + 1, 0);

    const totalMs = maxDate.getTime() - minDate.getTime();
    if (totalMs === 0) return <div className="text-center text-slate-400 text-xs py-8">Données insuffisantes</div>;

    const today = new Date();
    const todayPct = totalMs > 0 ? ((today.getTime() - minDate.getTime()) / totalMs) * 100 : -1;

    const daysTotal = Math.ceil(totalMs / 86400000);
    const PX_PER_DAY = 4;
    const svgW = Math.max(daysTotal * PX_PER_DAY, 900);
    const LABEL_W = 140;
    const HEADER_H = 50;
    const ROW_H = 30;
    const HEADER_MONTH_H = 22;
    const HEADER_WEEK_H = HEADER_H - HEADER_MONTH_H;

    const toX = (d: Date): number => {
      return LABEL_W + ((d.getTime() - minDate.getTime()) / totalMs) * (svgW - LABEL_W);
    };

    const months: { label: string; x1: number; x2: number; weeks: { label: string; x1: number }[] }[] = [];
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const monthStart = new Date(Math.max(cur.getTime(), minDate.getTime()));
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const monthEndClamped = new Date(Math.min(monthEnd.getTime(), maxDate.getTime()));

      const weeks: { label: string; x1: number }[] = [];
      const weekCursor = new Date(monthStart);
      while (weekCursor <= monthEndClamped) {
        weeks.push({
          label: `S${Math.ceil(weekCursor.getDate() / 7)}`,
          x1: toX(weekCursor),
        });
        weekCursor.setDate(weekCursor.getDate() + 7);
      }

      months.push({
        label: cur.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        x1: toX(monthStart),
        x2: toX(monthEndClamped),
        weeks,
      });
      cur.setMonth(cur.getMonth() + 1);
    }

    const phaseOrder = GANTT_PHASES.map(p => p.label);
    const grouped = new Map<string, typeof result.gantt>();
    for (const g of result.gantt) {
      if (!grouped.has(g.phase)) grouped.set(g.phase, []);
      grouped.get(g.phase)!.push(g);
    }

    const rows: { phase: string; region: string; debut: Date; fin: Date; color: string; detail?: string }[] = [];
    for (const phase of phaseOrder) {
      const items = grouped.get(phase) || [];
      for (const item of items) rows.push({ ...item });
    }

    const chartH = HEADER_H + rows.length * ROW_H + 10;

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-slate-800">Diagramme de Gantt</h4>
          <span className="text-[10px] text-slate-400">{daysTotal} jours — {months.length} mois</span>
        </div>
        <div ref={ganttRef} className="overflow-x-auto border border-slate-200 rounded-lg">
          <svg width={svgW} height={chartH} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="barShadow" x="-2%" y="-10%" width="104%" height="130%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Background */}
            <rect x={0} y={0} width={svgW} height={chartH} fill="#fafbfc" />

            {/* Month header row */}
            <rect x={0} y={0} width={svgW} height={HEADER_MONTH_H} fill="#1E3A5F" />
            {months.map((m, i) => (
              <g key={`mh-${i}`}>
                <rect x={m.x1} y={0} width={m.x2 - m.x1} height={HEADER_MONTH_H}
                  fill={i % 2 === 0 ? '#1E3A5F' : '#253d5e'} stroke="#1E3A5F" strokeWidth={0.5} />
                <text x={m.x1 + (m.x2 - m.x1) / 2} y={15} textAnchor="middle"
                  fontSize={10} fill="white" fontWeight="700" fontFamily="sans-serif">
                  {m.label}
                </text>
              </g>
            ))}

            {/* Week header row */}
            <rect x={0} y={HEADER_MONTH_H} width={svgW} height={HEADER_WEEK_H} fill="#e8edf2" />
            {months.map((m, mi) =>
              m.weeks.map((w, wi) => (
                <g key={`wh-${mi}-${wi}`}>
                  <line x1={w.x1} y1={HEADER_MONTH_H} x2={w.x1} y2={HEADER_H} stroke="#cbd5e1" strokeWidth={0.5} />
                  <text x={w.x1 + 8} y={HEADER_MONTH_H + 14} fontSize={8} fill="#64748b" fontWeight="500" fontFamily="sans-serif">
                    {w.label}
                  </text>
                </g>
              ))
            )}

            {/* Label column header */}
            <rect x={0} y={0} width={LABEL_W} height={HEADER_H} fill="#1E3A5F" />
            <text x={LABEL_W / 2} y={HEADER_H / 2 + 4} textAnchor="middle" fontSize={10} fill="white" fontWeight="700" fontFamily="sans-serif">
              Phase / Région
            </text>

            {/* Vertical grid lines for months */}
            {months.map((m, i) => (
              <line key={`vg-${i}`} x1={m.x1} y1={HEADER_H} x2={m.x1} y2={chartH} stroke="#e2e8f0" strokeWidth={0.5} />
            ))}

            {/* Horizontal grid lines */}
            {rows.map((_, i) => {
              const y = HEADER_H + i * ROW_H;
              return <line key={`hg-${i}`} x1={LABEL_W} y1={y} x2={svgW} y2={y} stroke="#f1f5f9" strokeWidth={0.5} />;
            })}

            {/* Holiday impact bands */}
            {(() => {
              const projStart = minDate.getFullYear();
              const projEnd = maxDate.getFullYear();
              const bands: { x1: number; x2: number; label: string; color: string }[] = [];
              for (let y = projStart; y <= projEnd; y++) {
                const hols = detectSenegalHolidays(y);
                for (const h of hols) {
                  const avant = (params as Record<string, unknown>)[h.avantKey] as number ?? 5;
                  const apres = (params as Record<string, unknown>)[h.apresKey] as number ?? 3;
                  const zoneStart = new Date(h.autoDate);
                  zoneStart.setDate(zoneStart.getDate() - avant);
                  const zoneEnd = new Date(h.autoDate);
                  zoneEnd.setDate(zoneEnd.getDate() + apres);
                  if (zoneEnd < minDate || zoneStart > maxDate) continue;
                  const bx1 = Math.max(toX(zoneStart), LABEL_W);
                  const bx2 = Math.min(toX(zoneEnd), svgW);
                  bands.push({ x1: bx1, x2: bx2, label: h.name, color: h.name.includes('Magal') ? '#DC2626' : h.name.includes('Gamou') ? '#D97706' : h.name.includes('Tabaski') ? '#7C3AED' : '#2563EB' });
                  bands.push({ x1: Math.max(toX(h.autoDate), LABEL_W), x2: Math.min(toX(h.autoDate) + 2, svgW), label: h.name + ' (jour)', color: h.name.includes('Magal') ? '#991B1B' : h.name.includes('Gamou') ? '#92400E' : h.name.includes('Tabaski') ? '#5B21B6' : '#1E40AF' });
                }
              }
              return bands.map((b, i) => (
                <g key={`hb-${i}`}>
                  <rect x={b.x1} y={HEADER_H} width={Math.max(b.x2 - b.x1, 1)} height={chartH - HEADER_H}
                    fill={b.color} opacity={0.08} />
                  <line x1={b.x1} y1={HEADER_H} x2={b.x1} y2={chartH}
                    stroke={b.color} strokeWidth={0.5} opacity={0.3} strokeDasharray="3 2" />
                  <line x1={b.x2} y1={HEADER_H} x2={b.x2} y2={chartH}
                    stroke={b.color} strokeWidth={0.5} opacity={0.3} strokeDasharray="3 2" />
                </g>
              ));
            })()}

            {/* Label column rows */}
            {rows.map((row, i) => {
              const y = HEADER_H + i * ROW_H;
              const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
              return (
                <g key={`label-${i}`}>
                  <rect x={0} y={y} width={LABEL_W} height={ROW_H} fill={bg} />
                  <line x1={LABEL_W} y1={y} x2={LABEL_W} y2={y + ROW_H} stroke="#e2e8f0" strokeWidth={0.5} />
                  <circle cx={12} cy={y + ROW_H / 2} r={3.5} fill={row.color} />
                  <text x={20} y={y + ROW_H / 2 + 1} fontSize={9} fill="#334155" fontWeight="600" fontFamily="sans-serif" dominantBaseline="middle">
                    {row.region}
                  </text>
                  <text x={20} y={y + ROW_H / 2 + 11} fontSize={7.5} fill="#94a3b8" fontWeight="400" fontFamily="sans-serif">
                    {row.phase.length > 18 ? row.phase.slice(0, 18) + '…' : row.phase}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {rows.map((row, i) => {
              const y = HEADER_H + i * ROW_H;
              const x1 = toX(row.debut);
              const x2 = toX(row.fin);
              const barW = Math.max(x2 - x1, 6);
              const barY = y + 5;
              const barH = ROW_H - 10;
              const tooltipId = `tip-${i}`;
              const isOver = barW > 50;
              return (
                <g key={`bar-${i}`}>
                  <title id={tooltipId}>{row.phase} — {row.region}&#10;{fmtDate(row.debut)} → {fmtDate(row.fin)}&#10;{row.detail || ''}</title>
                  <rect x={x1} y={barY} width={barW} height={barH} rx={4} ry={4}
                    fill={row.color} opacity={0.9} filter="url(#barShadow)">
                    <title>{row.phase} — {row.region}&#10;{fmtDate(row.debut)} → {fmtDate(row.fin)}&#10;{row.detail || ''}</title>
                  </rect>
                  <rect x={x1} y={barY} width={barW} height={barH / 2} rx={4} ry={4}
                    fill="white" opacity={0.15} />
                  {isOver && (
                    <text x={x1 + 6} y={barY + barH / 2 + 1} fontSize={8} fill="white" fontWeight="700"
                      fontFamily="sans-serif" dominantBaseline="middle" pointerEvents="none">
                      {row.region.slice(0, 3)} · {row.phase.length > 12 ? row.phase.slice(0, 12) + '…' : row.phase}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Today line */}
            {todayPct >= 0 && todayPct <= 100 && (
              <g>
                <line x1={toX(today)} y1={HEADER_H} x2={toX(today)} y2={chartH}
                  stroke="#dc2626" strokeWidth={1.5} strokeDasharray="5 3" />
                <rect x={toX(today) - 22} y={HEADER_H - 1} width={44} height={14} rx={3} fill="#dc2626" />
                <text x={toX(today)} y={HEADER_H + 9} textAnchor="middle" fontSize={7.5} fill="white" fontWeight="700" fontFamily="sans-serif">
                  Aujourd'hui
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-100">
          {GANTT_PHASES.map(p => (
            <span key={p.label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="w-3 h-3 rounded" style={{ background: p.color }} />
              {p.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[10px] text-red-500">
            <span className="w-4 h-0 border-t-2 border-dashed border-red-500" />
            Aujourd'hui
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
            Magal
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
            Gamou
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
            Tabaski
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
            Korité
          </span>
        </div>
      </div>
    );
  };

  /* ── Ressources ── */

  const renderRessources = () => {
    const sy = result.synthese;
    const allRows: {
      period: string; elecI: number; elecR: number; macons: number;
      prep: number; transport: number; ctrl: number; total: number;
    }[] = [];

    const totalPrep = (params.preparateursKaffrine || 0) + (params.preparateursTamba || 0);

    for (let mois = 1; mois <= Math.ceil(sy.dureeProjetMois) + 1; mois++) {
      const mDebut = addDaysStr(params.dateDebut || '2026-07-13', (mois - 1) * 30);
      const mFin = addDaysStr(params.dateDebut || '2026-07-13', mois * 30);
      let elecI = 0, elecR = 0, macons = 0, transport = 0, ctrl = 0;
      for (const [, r] of Object.entries(result.regions)) {
        if (mDebut < r.install.fin && mFin > r.install.debut) elecI += r.install.equipes * (params.installEffectifEquipe || 2);
        if (mDebut < r.reseau.fin && mFin > r.reseau.debut) elecR += r.reseau.equipes * (params.reseauEffectifEquipe || 2);
        if (mDebut < r.macon.fin && mFin > r.macon.debut) macons += r.macon.equipes * (params.maconEffectifEquipe || 2);
        if (mDebut < r.transport.fin && mFin > r.transport.debut) transport += r.transport.equipes * (params.transportEffectifEquipe || 2);
        if (mDebut < r.controle.fin && mFin > r.controle.debut) ctrl += r.controle.equipes;
      }
      if (elecI + elecR + macons + transport + ctrl + totalPrep === 0) continue;
      const total = elecI + elecR + macons + totalPrep + transport + ctrl;
      allRows.push({
        period: mDebut.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        elecI, elecR, macons, prep: totalPrep, transport, ctrl, total,
      });
    }

    const maxTotal = allRows.reduce((mx, r) => Math.max(mx, r.total), 0);

    const resourceRows = [
      { label: 'Électriciens installation', key: 'elecI' as const, color: 'text-sky-600', bg: 'bg-sky-50' },
      { label: 'Électriciens réseau', key: 'elecR' as const, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { label: 'Maçons', key: 'macons' as const, color: 'text-amber-600', bg: 'bg-amber-50' },
      { label: 'Préparateurs', key: 'prep' as const, color: 'text-orange-600', bg: 'bg-orange-50' },
      { label: 'Transport', key: 'transport' as const, color: 'text-yellow-700', bg: 'bg-yellow-50' },
      { label: 'Contrôleurs', key: 'ctrl' as const, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-xs font-bold text-slate-800 mb-1">Mobilisation mensuelle des ressources</h4>
        <p className="text-[10px] text-slate-400 mb-4">Personnes mobilisées par mois — les mois pointe sont surlignés</p>
        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2.5 text-left font-semibold text-[10px]">Période</th>
                {resourceRows.map(r => (
                  <th key={r.key} className="px-3 py-2.5 text-center font-semibold text-[10px]">{r.label}</th>
                ))}
                <th className="px-3 py-2.5 text-center font-bold text-[10px] bg-slate-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((r, i) => {
                const isPeak = r.total === maxTotal && r.total > 0;
                return (
                  <tr key={i} className={`border-t border-slate-100 transition-colors ${
                    isPeak ? 'bg-amber-50 ring-1 ring-inset ring-amber-300' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}>
                    <td className="px-3 py-2 font-semibold text-slate-700">
                      {r.period}
                      {isPeak && <span className="ml-1.5 text-[9px] text-amber-600 font-bold">POINT</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-sky-600 font-semibold">{r.elecI || '-'}</td>
                    <td className="px-3 py-2 text-center text-indigo-600 font-semibold">{r.elecR || '-'}</td>
                    <td className="px-3 py-2 text-center text-amber-600 font-semibold">{r.macons || '-'}</td>
                    <td className="px-3 py-2 text-center text-orange-600 font-semibold">{r.prep || '-'}</td>
                    <td className="px-3 py-2 text-center text-yellow-700 font-semibold">{r.transport || '-'}</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-semibold">{r.ctrl || '-'}</td>
                    <td className={`px-3 py-2 text-center font-black text-slate-900 ${isPeak ? 'bg-amber-100' : 'bg-slate-100'}`}>
                      {r.total}
                    </td>
                  </tr>
                );
              })}
              {allRows.length > 0 && (
                <tr className="border-t-2 border-slate-300 bg-slate-800 text-white font-bold">
                  <td className="px-3 py-2 text-[10px]">TOTAL PROJET</td>
                  <td className="px-3 py-2 text-center text-[10px]">{allRows.reduce((s, r) => s + r.elecI, 0)}</td>
                  <td className="px-3 py-2 text-center text-[10px]">{allRows.reduce((s, r) => s + r.elecR, 0)}</td>
                  <td className="px-3 py-2 text-center text-[10px]">{allRows.reduce((s, r) => s + r.macons, 0)}</td>
                  <td className="px-3 py-2 text-center text-[10px]">{allRows.reduce((s, r) => s + r.prep, 0)}</td>
                  <td className="px-3 py-2 text-center text-[10px]">{allRows.reduce((s, r) => s + r.transport, 0)}</td>
                  <td className="px-3 py-2 text-center text-[10px]">{allRows.reduce((s, r) => s + r.ctrl, 0)}</td>
                  <td className="px-3 py-2 text-center text-[10px] font-black">{allRows.reduce((s, r) => s + r.total, 0)}</td>
                </tr>
              )}
              {allRows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400 text-xs">Aucune donnée ressource</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ── Optimization Tab ── */

  const renderOptimization = () => {
    return (
      <div className="space-y-4">
        {/* Optimization Options */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-xs font-bold text-slate-800 mb-3">🧠 Options d'optimisation</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase">Objectif durée (mois)</label>
              <input
                type="number"
                min={1}
                max={24}
                value={optimizationOptions.targetDurationMonths || 2}
                onChange={e => setOptimizationOptions({ ...optimizationOptions, targetDurationMonths: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase">Multiplicateur coût max</label>
              <input
                type="number"
                min={1}
                max={3}
                step={0.1}
                value={optimizationOptions.maxCostMultiplier || 1.5}
                onChange={e => setOptimizationOptions({ ...optimizationOptions, maxCostMultiplier: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase">Stratégie</label>
              <select
                value={optimizationOptions.optimizeFor || 'balanced'}
                onChange={e => setOptimizationOptions({ ...optimizationOptions, optimizeFor: e.target.value as any })}
                className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
              >
                <option value="duration">Priorité délai</option>
                <option value="cost">Priorité coût</option>
                <option value="balanced">Équilibré</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleOptimizePlanning}
              disabled={optimizing}
              className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${
                optimizing 
                  ? 'bg-slate-400 text-slate-600 cursor-not-allowed' 
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {optimizing ? '⏳ Optimisation en cours...' : '🧠 Optimiser le planning'}
            </button>
          </div>
        </div>

        {/* Optimized Configurations */}
        {optimizedConfigurations.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-xs font-bold text-slate-800 mb-3">📊 Configurations optimisées ({optimizedConfigurations.length})</h4>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {optimizedConfigurations.map((config, index) => (
                <div
                  key={index}
                  onClick={() => handleSelectConfiguration(config)}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    selectedConfiguration === config
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-purple-200 bg-white hover:border-purple-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-700">
                        #{index + 1} - {config.params.modeRegions === 'parallele' ? 'Parallèle' : 'Séquentiel'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {config.params.regionsOrdre?.join(' → ') || 'Kaffrine → Tambacounda'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-600">
                        Score: {config.score.toFixed(2)}
                      </span>
                      {index === 0 && (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          ⭐ Meilleur
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Durée:</span>
                      <span className="font-semibold text-slate-700 ml-1">
                        {config.metrics.durationMonths.toFixed(1)} mois
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Coût:</span>
                      <span className="font-semibold text-slate-700 ml-1">
                        {(config.metrics.totalCost / 1000).toFixed(0)}k
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Ressources:</span>
                      <span className="font-semibold text-slate-700 ml-1">
                        {(config.metrics.resourceUtilization * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Risque:</span>
                      <span className="font-semibold text-slate-700 ml-1">
                        {config.metrics.riskScore.toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Élec: {config.params.totalElectricians} | Maçons: {config.params.maconEquipesKaffrine + config.params.maconEquipesTamba} | Pipeline: {config.params.reseauPipelineDebut}%
                  </div>
                </div>
              ))}
            </div>
            {selectedConfiguration && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={handleApplyOptimizedConfiguration}
                  disabled={saving}
                  className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${
                    saving
                      ? 'bg-slate-400 text-slate-600 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {saving ? 'Sauvegarde...' : '✅ Appliquer la configuration sélectionnée'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Current vs Optimized Comparison */}
        {selectedConfiguration && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="text-xs font-bold text-slate-800 mb-3">📈 Comparaison Avant/Après</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <h5 className="text-xs font-bold text-slate-600 mb-2">Configuration actuelle</h5>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Durée:</span>
                    <span className="font-semibold text-slate-700">{result.synthese.dureeMois.toFixed(1)} mois</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Alertes:</span>
                    <span className="font-semibold text-slate-700">{result.alertes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Électriciens:</span>
                    <span className="font-semibold text-slate-700">{params.totalElectricians}</span>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <h5 className="text-xs font-bold text-purple-600 mb-2">Configuration optimisée</h5>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Durée:</span>
                    <span className="font-semibold text-purple-700">{selectedConfiguration.metrics.durationMonths.toFixed(1)} mois</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Alertes:</span>
                    <span className="font-semibold text-purple-700">{selectedConfiguration.result.alertes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Électriciens:</span>
                    <span className="font-semibold text-purple-700">{selectedConfiguration.params.totalElectricians}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              💡 La configuration optimisée {' '}
              {selectedConfiguration.metrics.durationMonths < result.synthese.dureeMois 
                ? `réduit la durée de ${(result.synthese.dureeMois - selectedConfiguration.metrics.durationMonths).toFixed(1)} mois`
                : `augmente la durée de ${(selectedConfiguration.metrics.durationMonths - result.synthese.dureeMois).toFixed(1)} mois`
              }
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── Planning Wizard ── */

  const renderWizard = () => {
    if (!wizardOpen) return null;

    const stepContent = () => {
      switch (wizardStep) {
        case 0:
          return (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Définissez les dates clés du projet.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Date de début</label>
                  <input type="date" value={String(params.dateDebut || '')}
                    onChange={e => updateWizardParam('dateDebut', e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Date limite projet</label>
                  <input type="date" value={String(params.dateLimiteProjet || '')}
                    onChange={e => updateWizardParam('dateLimiteProjet', e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase">Durée objectif (mois)</label>
                <input type="number" min={1} max={24} value={String(params.dureeObjectifMois || 2)}
                  onChange={e => updateWizardParam('dureeObjectifMois', Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          );
        case 1:
          return (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Configurez la formation des électriciens.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Durée session (jours)</label>
                  <input type="number" min={1} max={10} value={String(params.formationDureeJours ?? 3)}
                    onChange={e => updateWizardParam('formationDureeJours', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Max personnes/session</label>
                  <input type="number" min={5} max={50} value={String(params.formationMaxPersonnes ?? 25)}
                    onChange={e => updateWizardParam('formationMaxPersonnes', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Nombre de formateurs</label>
                  <input type="number" min={1} max={10} value={String(params.nbFormateurs ?? 1)}
                    onChange={e => updateWizardParam('nbFormateurs', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Pause entre sessions (jours)</label>
                  <input type="number" min={0} max={10} value={String(params.pauseEntreSessions ?? 0)}
                    onChange={e => updateWizardParam('pauseEntreSessions', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase">Mode de formation</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => updateWizardParam('formationMode', 'sequentiel')}
                    className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                      params.formationMode === 'sequentiel' || !params.formationMode
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>
                    Séquentiel
                  </button>
                  <button onClick={() => updateWizardParam('formationMode', 'parallele')}
                    className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                      params.formationMode === 'parallele'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}>
                    Parallèle
                  </button>
                </div>
              </div>
            </div>
          );
        case 2:
          return (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Effectifs maçons. Laissez à 0 pour le calcul automatique.</p>
              <div className="flex items-center gap-3 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500">Mode automatique : le nombre de maçons est calculé selon le nombre de ménages et la durée objectif.</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Maçons Kaffrine (0=auto)</label>
                  <input type="number" min={0} value={String(params.maconsKaffrine || 0)}
                    onChange={e => updateWizardParam('maconsKaffrine', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Maçons Tambacounda (0=auto)</label>
                  <input type="number" min={0} value={String(params.maconsTamba || 0)}
                    onChange={e => updateWizardParam('maconsTamba', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase">Cadence (murs/j/équipe)</label>
                <input type="number" min={1} max={10} value={String(params.maconCadenceJour || 2)}
                  onChange={e => updateWizardParam('maconCadenceJour', Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          );
        case 3:
          return (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Effectifs installation. Laissez à 0 pour le calcul automatique.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Équipes Kaffrine (0=auto)</label>
                  <input type="number" min={0} value={String(params.installEquipesKaffrine || 0)}
                    onChange={e => updateWizardParam('installEquipesKaffrine', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Équipes Tambacounda (0=auto)</label>
                  <input type="number" min={0} value={String(params.installEquipesTamba || 0)}
                    onChange={e => updateWizardParam('installEquipesTamba', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Élec./équipe</label>
                  <input type="number" min={1} max={10} value={String(params.installEffectifEquipe || 2)}
                    onChange={e => updateWizardParam('installEffectifEquipe', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Cadence (mén/j/équipe)</label>
                  <input type="number" min={1} max={20} value={String(params.installCadenceJour || 2)}
                    onChange={e => updateWizardParam('installCadenceJour', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
            </div>
          );
        case 4:
          return (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Effectifs réseau BT. Laissez à 0 pour le calcul automatique.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Équipes Kaffrine (0=auto)</label>
                  <input type="number" min={0} value={String(params.reseauEquipesKaffrine || 0)}
                    onChange={e => updateWizardParam('reseauEquipesKaffrine', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Équipes Tambacounda (0=auto)</label>
                  <input type="number" min={0} value={String(params.reseauEquipesTamba || 0)}
                    onChange={e => updateWizardParam('reseauEquipesTamba', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Élec./équipe</label>
                  <input type="number" min={1} max={10} value={String(params.reseauEffectifEquipe || 2)}
                    onChange={e => updateWizardParam('reseauEffectifEquipe', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">Cadence (mén/j/équipe)</label>
                  <input type="number" min={1} max={50} value={String(params.reseauCadenceJour || 20)}
                    onChange={e => updateWizardParam('reseauCadenceJour', Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase">Pipeline démarrage (% d'installation)</label>
                <input type="number" min={1} max={100} value={String(params.reseauPipelineDebut || 15)}
                  onChange={e => updateWizardParam('reseauPipelineDebut', Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          );
        case 5: {
          const holidayYear = new Date(params.dateDebut || '2026-07-20').getFullYear();
          const detected = detectSenegalHolidays(holidayYear);
          return (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">Paramètres calendrier — jours fériés, événements religieux et saison des pluies.</p>
              <div className="space-y-3">
                {[
                  { key: 'samediTravaille', label: 'Samedi travaillé' },
                  { key: 'dimancheTravaille', label: 'Dimanche travaillé' },
                  { key: 'compterJoursFeries', label: 'Jours fériés officiels' },
                  { key: 'compterJoursReligieux', label: 'Événements religieux (calendrier hégirien)' },
                  { key: 'compterSaisonPluie', label: 'Saison des pluies' },
                ].map(t => (
                  <div key={t.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700">{t.label}</span>
                    <button onClick={() => updateWizardParam(t.key, !(params as Record<string, unknown>)[t.key])}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        (params as Record<string, unknown>)[t.key] ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        (params as Record<string, unknown>)[t.key] ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>

              {params.compterJoursReligieux && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h5 className="text-[10px] font-bold text-blue-800 uppercase mb-2">
                    Événements religieux {holidayYear} — Détection automatique (calendrier hégirien)
                  </h5>
                  <p className="text-[9px] text-blue-600 mb-3">
                    Dates calculées automatiquement. Vous pouvez les ajuster manuellement si la date exacte est connue.
                  </p>
                  <div className="space-y-2">
                    {detected.map(h => {
                      const overrideVal = (params as Record<string, unknown>)[h.overrideKey] as string | undefined;
                      const displayDate = overrideVal || h.autoDate.toISOString().slice(0, 10);
                      const isOverridden = !!overrideVal;
                      return (
                        <div key={h.key} className="flex items-center gap-2 p-2 bg-white rounded-md border border-blue-100">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-700">{h.name}</span>
                              {isOverridden && (
                                <span className="text-[8px] font-bold text-amber-600 bg-amber-100 px-1 rounded">MANUEL</span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-400">
                              Auto: {fmtDate(h.autoDate)}
                            </div>
                          </div>
                          <input
                            type="date"
                            value={displayDate}
                            onChange={e => updateWizardParam(h.overrideKey, e.target.value || undefined)}
                            className="w-[140px] px-2 py-1 text-[11px] text-slate-800 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          {isOverridden && (
                            <button
                              onClick={() => updateWizardParam(h.overrideKey, undefined)}
                              className="text-[9px] text-red-500 hover:text-red-700 font-semibold whitespace-nowrap"
                              title="Rétablir la date calculée"
                            >
                              Auto
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Nouvelle configuration binaire pour l'impact des événements */}
                  <div className="mt-4 border-t border-blue-200 pt-3">
                    <h5 className="text-[10px] font-bold text-blue-800 uppercase mb-2">
                      Configuration de l'impact des événements
                    </h5>
                    <p className="text-[9px] text-blue-600 mb-3">
                      Configurez l'impact de chaque événement sur le planning (nouveau système binaire).
                    </p>
                    <div className="space-y-3">
                      {detected.map(h => {
                        const eventConfig = (params.eventCalendrier || {}) as Record<string, unknown>;
                        const isNonOuvre = (eventConfig[h.key + 'NonOuvre'] as boolean) ?? false;
                        const isAvantPartiel = (eventConfig[h.key + 'AvantPartiel'] as boolean) ?? false;
                        const isApresPartiel = (eventConfig[h.key + 'ApresPartiel'] as boolean) ?? false;
                        const avantReduction = (eventConfig[h.key + 'AvantReduction'] as number) ?? 0.5;
                        const apresReduction = (eventConfig[h.key + 'ApresReduction'] as number) ?? 0.5;
                        
                        const updateEventConfig = (key: string, value: unknown) => {
                          const currentConfig = (params.eventCalendrier || {}) as Record<string, unknown>;
                          updateWizardParam('eventCalendrier', { ...currentConfig, [key]: value });
                        };
                        
                        return (
                          <div key={h.key} className="bg-white rounded-md border border-blue-100 p-2">
                            <div className="text-[10px] font-bold text-slate-700 mb-2">{h.name}</div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`${h.key}-non-ouvre`}
                                  checked={isNonOuvre}
                                  onChange={e => updateEventConfig(h.key + 'NonOuvre', e.target.checked)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor={`${h.key}-non-ouvre`} className="text-[9px] text-slate-600">
                                  Jour complètement non ouvré
                                </label>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`${h.key}-avant-partiel`}
                                  checked={isAvantPartiel}
                                  onChange={e => updateEventConfig(h.key + 'AvantPartiel', e.target.checked)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor={`${h.key}-avant-partiel`} className="text-[9px] text-slate-600">
                                  Jours avant partiellement ouvrés
                                </label>
                              </div>
                              
                              {isAvantPartiel && (
                                <div className="ml-6 flex items-center gap-2">
                                  <label className="text-[9px] text-slate-500">Réduction:</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={avantReduction}
                                    onChange={e => updateEventConfig(h.key + 'AvantReduction', Number(e.target.value))}
                                    className="w-16 px-2 py-1 text-[9px] text-slate-800 border border-slate-200 rounded"
                                  />
                                  <span className="text-[9px] text-slate-500">jour équivalent</span>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`${h.key}-apres-partiel`}
                                  checked={isApresPartiel}
                                  onChange={e => updateEventConfig(h.key + 'ApresPartiel', e.target.checked)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor={`${h.key}-apres-partiel`} className="text-[9px] text-slate-600">
                                  Jours après partiellement ouvrés
                                </label>
                              </div>
                              
                              {isApresPartiel && (
                                <div className="ml-6 flex items-center gap-2">
                                  <label className="text-[9px] text-slate-500">Réduction:</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={apresReduction}
                                    onChange={e => updateEventConfig(h.key + 'ApresReduction', Number(e.target.value))}
                                    className="w-16 px-2 py-1 text-[9px] text-slate-800 border border-slate-200 rounded"
                                  />
                                  <span className="text-[9px] text-slate-500">jour équivalent</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {params.compterSaisonPluie && (
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 uppercase">Début pluies (MM-JJ)</label>
                    <input type="text" value={String(params.saisonPluieDebut || '07-01')}
                      onChange={e => updateWizardParam('saisonPluieDebut', e.target.value)}
                      placeholder="07-01"
                      className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 uppercase">Fin pluies (MM-JJ)</label>
                    <input type="text" value={String(params.saisonPluieFin || '10-15')}
                      onChange={e => updateWizardParam('saisonPluieFin', e.target.value)}
                      placeholder="10-15"
                      className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 uppercase">Impact pluie (%)</label>
                    <input type="number" min={0} max={100} value={String(params.impactPluie ?? 50)}
                      onChange={e => updateWizardParam('impactPluie', Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                </div>
              )}
            </div>
          );
        }
        case 6: {
          return (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                L'IA peut optimiser votre configuration de planning en analysant différents scénarios et en proposant les meilleures options.
              </p>
              
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                <h4 className="text-xs font-bold text-indigo-800 mb-2">Options d'optimisation</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 uppercase">Objectif de durée (mois)</label>
                    <input 
                      type="number" 
                      min={1} 
                      max={12} 
                      step={0.5}
                      value={optimizationOptions.targetDurationMonths}
                      onChange={e => setOptimizationOptions({...optimizationOptions, targetDurationMonths: Number(e.target.value)})}
                      className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 uppercase">Multiplicateur de coût max</label>
                    <input 
                      type="number" 
                      min={1} 
                      max={3} 
                      step={0.1}
                      value={optimizationOptions.maxCostMultiplier}
                      onChange={e => setOptimizationOptions({...optimizationOptions, maxCostMultiplier: Number(e.target.value)})}
                      className="w-full mt-1 px-3 py-2 text-sm text-slate-800 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 uppercase">Priorité</label>
                    <div className="flex gap-2 mt-1">
                      <button 
                        onClick={() => setOptimizationOptions({...optimizationOptions, optimizeFor: 'speed'})}
                        className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                          optimizationOptions.optimizeFor === 'speed'
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Vitesse
                      </button>
                      <button 
                        onClick={() => setOptimizationOptions({...optimizationOptions, optimizeFor: 'cost'})}
                        className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                          optimizationOptions.optimizeFor === 'cost'
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Coût
                      </button>
                      <button 
                        onClick={() => setOptimizationOptions({...optimizationOptions, optimizeFor: 'balanced'})}
                        className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                          optimizationOptions.optimizeFor === 'balanced'
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Équilibré
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  setOptimizing(true);
                  try {
                    const configs = await optimizePlanning(params, menageCounts, optimizationOptions);
                    setOptimizedConfigurations(configs);
                    if (configs.length > 0) {
                      setSelectedConfiguration(configs[0]);
                    }
                  } catch (error) {
                    console.error('Optimization failed:', error);
                  } finally {
                    setOptimizing(false);
                  }
                }}
                disabled={optimizing}
                className={`w-full py-3 px-4 rounded-lg font-bold text-sm transition-all ${
                  optimizing
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg'
                }`}
              >
                {optimizing ? 'Optimisation en cours...' : 'Lancer l\'optimisation IA'}
              </button>

              {optimizedConfigurations.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">Configurations optimisées</h4>
                  {optimizedConfigurations.map((config, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedConfiguration(config)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedConfiguration === config
                          ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200'
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-700">Option {index + 1}</span>
                        <span className="text-[10px] font-semibold text-indigo-600">
                          Score: {config.score?.toFixed(1)}/100
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Durée: {config.durationMonths?.toFixed(1)} mois | Coût: {config.costMultiplier?.toFixed(1)}x
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedConfiguration && (
                <button
                  onClick={() => {
                    // Apply the selected configuration
                    const newParams = { ...params, ...selectedConfiguration.params };
                    setParams(newParams);
                    setWizardOpen(false);
                  }}
                  className="w-full py-3 px-4 rounded-lg font-bold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg"
                >
                  Appliquer la configuration sélectionnée
                </button>
              )}
            </div>
          );
        }
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Assistant Planning</h3>
                <p className="text-[10px] opacity-70 mt-0.5">Étape {wizardStep + 1} / {WIZARD_STEPS.length} — {WIZARD_STEPS[wizardStep].desc}</p>
              </div>
              <button onClick={() => setWizardOpen(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold text-sm transition-colors">
                ✕
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1 px-6 pt-4">
            {WIZARD_STEPS.map((s, i) => (
              <button key={i} onClick={() => setWizardStep(i)}
                className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${
                  i === wizardStep ? 'bg-blue-600' : i < wizardStep ? 'bg-blue-300' : 'bg-slate-200'
                }`} />
            ))}
          </div>

          {/* Step labels */}
          <div className="flex gap-1 px-6 pt-3 pb-1">
            {WIZARD_STEPS.map((s, i) => (
              <div key={i} className={`flex-1 text-center text-[9px] font-semibold transition-colors ${
                i === wizardStep ? 'text-blue-600' : i < wizardStep ? 'text-emerald-500' : 'text-slate-300'
              }`}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="px-6 py-4 min-h-[220px]">
            <h4 className="text-sm font-bold text-slate-800 mb-3">{WIZARD_STEPS[wizardStep].title}</h4>
            {stepContent()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => wizardStep > 0 ? setWizardStep(wizardStep - 1) : setWizardOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {wizardStep > 0 ? '← Précédent' : 'Annuler'}
            </button>
            {wizardStep < WIZARD_STEPS.length - 1 ? (
              <button
                onClick={() => setWizardStep(wizardStep + 1)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Suivant →
              </button>
            ) : (
              <button
                onClick={applyWizardAndSave}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Appliquer ✓
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ── Sub-tabs ── */

  const SUB_TABS: { key: PlanningSubTab; label: string; icon: string }[] = [
    { key: 'synthese', label: 'Synthèse', icon: '📊' },
    { key: 'parametres', label: 'Paramètres', icon: '⚙️' },
    { key: 'formation', label: 'Formation', icon: '📚' },
    { key: 'planification', label: 'Planification', icon: '📋' },
    { key: 'gantt', label: 'Gantt', icon: '🗓' },
    { key: 'ressources', label: 'Ressources', icon: '👷' },
    { key: 'optimisation', label: 'Optimisation IA', icon: '🧠' },
  ];

  return (
    <div className="flex flex-col h-full print:h-auto">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 no-print">
        <div className="flex gap-1 overflow-x-auto">
          {SUB_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-4">
          {saving && <span className="text-[10px] text-blue-500 animate-pulse">Sauvegarde...</span>}
          <button
            onClick={() => { setWizardOpen(true); setWizardStep(0); }}
            className="px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            🧙 Assistant
          </button>
          <button onClick={exportExcel} className="px-3 py-1.5 text-[10px] font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
            📥 Export Excel
          </button>
          <button 
            onClick={downloadPDF} 
            disabled={generatingPDF}
            className="px-3 py-1.5 text-[10px] font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingPDF ? '⏳ Génération...' : '📄 Télécharger PDF'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-6xl mx-auto w-full">
        {activeTab === 'synthese' && renderSynthese()}
        {activeTab === 'parametres' && renderParametres()}
        {activeTab === 'formation' && renderFormation()}
        {activeTab === 'planification' && renderPlanification()}
        {activeTab === 'gantt' && renderGantt()}
        {activeTab === 'ressources' && renderRessources()}
        {activeTab === 'optimisation' && renderOptimization()}
      </div>

      {renderWizard()}
    </div>
  );
});

PlanningView.displayName = 'PlanningView';
export default PlanningView;
