import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../hooks/carto_grappes.service';

interface AlertsConfig {
  delayDays: number;
  enabled: boolean;
  dismissed: boolean;
}

const AlertsView: React.FC = React.memo(() => {
  const [config, setConfig] = useState<AlertsConfig>({ delayDays: 15, enabled: true, dismissed: false });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.fetchAlertsConfig();
        if (!cancelled && data && typeof data === 'object') {
          setConfig(prev => ({ ...prev, ...data }));
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.saveAlertsConfig(config);
    } catch { /* ignore */ }
    setSaving(false);
  }, [config]);

  if (loading) {
    return (
      <div className="p-6 text-center">
        <span className="text-xs text-slate-400 animate-pulse">Chargement des alertes...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Configuration des alertes</h3>
        <p className="text-[11px] text-slate-400 mb-5">
          Paramétrez les seuils et le comportement des alertes automatiques.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between border border-slate-200 rounded-lg p-4">
            <div>
              <span className="text-xs font-bold text-slate-700">Alertes activées</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Afficher les alertes dans le tableau de bord</p>
            </div>
            <button
              onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${config.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <label className="text-xs font-bold text-slate-700 block mb-2">Délai d'alerte (jours)</label>
            <input
              type="number"
              value={config.delayDays}
              onChange={e => setConfig(prev => ({ ...prev, delayDays: Number(e.target.value) }))}
              min={1}
              max={90}
              className="w-full px-3 py-2 text-xs text-slate-800 border border-slate-200 rounded-lg bg-white font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Nombre de jours avant de déclencher une alerte de retard sur une tâche.
            </p>
          </div>

          <div className="flex items-center justify-between border border-slate-200 rounded-lg p-4">
            <div>
              <span className="text-xs font-bold text-slate-700">Masquer les alertes acquittées</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Ne plus afficher les alertes marquées comme vues</p>
            </div>
            <button
              onClick={() => setConfig(prev => ({ ...prev, dismissed: !prev.dismissed }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${config.dismissed ? 'bg-blue-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.dismissed ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Sauvegarde...' : '💾 Sauvegarder la configuration'}
          </button>
        </div>
      </div>
    </div>
  );
});

AlertsView.displayName = 'AlertsView';
export default AlertsView;
