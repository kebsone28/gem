import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../hooks/carto_grappes.service';
import { useNotifications } from '../hooks/useNotifications';
import type { LotKey } from '../types';
import { LOT_KEYS, LOT_TITLES } from '../constants';

interface Settings {
  bareme: Record<LotKey, number>;
  lotLabels: Record<LotKey, string>;
  featureToggles: {
    workflowEnabled: boolean;
    archiveEnabled: boolean;
    autoBackup: boolean;
  };
}

const DEFAULTS: Settings = {
  bareme: { A: 15000, B: 25000, C: 10000 },
  lotLabels: { A: 'Pré-câblage', B: 'Installation', C: 'Raccordement' },
  featureToggles: { workflowEnabled: false, archiveEnabled: false, autoBackup: false },
};

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  );
}

const SettingsView: React.FC = React.memo(() => {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const notif = useNotifications();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.fetchSettings();
        if (!cancelled && data && typeof data === 'object') {
          setSettings(prev => ({
            bareme: { ...prev.bareme, ...(data.bareme as Record<LotKey, number> || {}) },
            lotLabels: { ...prev.lotLabels, ...(data.lotLabels as Record<LotKey, string> || {}) },
            featureToggles: { ...prev.featureToggles, ...(data.featureToggles as Settings['featureToggles'] || {}) },
          }));
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.saveSettings(settings);
    } catch { /* ignore */ }
    setSaving(false);
  }, [settings]);

  const updateBareme = useCallback((lot: LotKey, value: number) => {
    setSettings(prev => ({ ...prev, bareme: { ...prev.bareme, [lot]: value } }));
  }, []);

  const updateLabel = useCallback((lot: LotKey, value: string) => {
    setSettings(prev => ({ ...prev, lotLabels: { ...prev.lotLabels, [lot]: value } }));
  }, []);

  const toggleFeature = useCallback((key: keyof Settings['featureToggles']) => {
    setSettings(prev => ({
      ...prev,
      featureToggles: { ...prev.featureToggles, [key]: !prev.featureToggles[key] },
    }));
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <span className="text-xs text-slate-400 animate-pulse">Chargement des paramètres…</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Paramètres généraux</h3>
        <p className="text-[11px] text-slate-400 mb-5">
          Barème FCFA, libellés des lots et fonctionnalités.
        </p>

        <div className="space-y-6">
          {/* Barème FCFA */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-3">Barème FCFA par lot</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LOT_KEYS.map(lot => (
                <div key={lot} className="border border-slate-300 rounded-lg p-4">
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">
                    {LOT_TITLES[lot]}
                  </label>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <input
                      type="number"
                      value={settings.bareme[lot]}
                      onChange={e => updateBareme(lot, Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">FCFA</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lot labels */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-3">Libellés des lots</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LOT_KEYS.map(lot => (
                <div key={lot} className="border border-slate-300 rounded-lg p-4">
                  <label className="text-[10px] font-semibold text-slate-600 uppercase">
                    Lot {lot}
                  </label>
                  <input
                    type="text"
                    value={settings.lotLabels[lot]}
                    onChange={e => updateLabel(lot, e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 font-medium mt-1.5 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Feature toggles */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-3">Fonctionnalités</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between border border-slate-300 rounded-lg p-4">
                <div>
                  <span className="text-xs font-bold text-slate-700">Workflow de validation</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Activer le circuit de validation avant modification</p>
                </div>
                <Toggle value={settings.featureToggles.workflowEnabled} onChange={() => toggleFeature('workflowEnabled')} />
              </div>
              <div className="flex items-center justify-between border border-slate-300 rounded-lg p-4">
                <div>
                  <span className="text-xs font-bold text-slate-700">Archivage des grappes</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Permettre l'archivage des grappes terminées</p>
                </div>
                <Toggle value={settings.featureToggles.archiveEnabled} onChange={() => toggleFeature('archiveEnabled')} />
              </div>
              <div className="flex items-center justify-between border border-slate-300 rounded-lg p-4">
                <div>
                  <span className="text-xs font-bold text-slate-700">Sauvegarde automatique</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Sauvegarder automatiquement les modifications</p>
                </div>
                <Toggle value={settings.featureToggles.autoBackup} onChange={() => toggleFeature('autoBackup')} />
              </div>
            </div>
          </div>

          {/* Notifications */}
          {notif.supported && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-3">Notifications</h4>
              <div className="flex items-center justify-between border border-slate-300 rounded-lg p-4">
                <div>
                  <span className="text-xs font-bold text-slate-700">Alertes push</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Recevoir les alertes critiques toutes les 30 min (bloqués, non conformes)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Statut : {notif.permission === 'granted' ? '✅ Autorisé' : notif.permission === 'denied' ? '❌ Refusé' : '⏳ Non demandé'}
                  </p>
                </div>
                {notif.enabled ? (
                  <button
                    onClick={notif.disableNotifications}
                    className="relative w-11 h-6 rounded-full bg-blue-600 transition-colors"
                  >
                    <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow translate-x-5 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={notif.requestPermission}
                    className="relative w-11 h-6 rounded-full bg-slate-300 transition-colors"
                  >
                    <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" />
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Sauvegarde…' : 'Sauvegarder les paramètres'}
          </button>
        </div>
      </div>
    </div>
  );
});

SettingsView.displayName = 'SettingsView';
export default SettingsView;
