import React, { useMemo } from 'react';
import type { LotKey, StatusValue, Menage } from '../types';
import { LOT_KEYS, LOT_TITLES, STATUS_MAP } from '../constants';

interface LotStatus {
  status: StatusValue;
  updatedAt: string | null;
}

interface ComputedAlertsProps {
  entries: Record<number, { A: LotStatus; B: LotStatus; C: LotStatus; conforme: boolean; obs: string }>;
  menages: Menage[];
  alertConfig: { delayDays: number; enabled: boolean } | null;
}

interface AlertItem {
  type: 'bloque' | 'non_conforme' | 'retard' | 'lot_inactif';
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  lot?: LotKey;
  ordre?: number;
}

const BLOQUE_PREFIXES: StatusValue[] = [
  'bloque_acces', 'bloque_absent', 'bloque_refus',
  'bloque_support', 'bloque_materiel', 'bloque_securite',
];

function isBloque(s: StatusValue): boolean {
  return BLOQUE_PREFIXES.includes(s);
}

function daysSince(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / 86_400_000);
}

const ComputedAlertsView: React.FC<ComputedAlertsProps> = React.memo(({ entries, menages, alertConfig }) => {
  const alerts = useMemo(() => {
    const result: AlertItem[] = [];
    const delayDays = alertConfig?.delayDays ?? 15;

    const menageByOrdre = new Map<number, Menage>();
    menages.forEach(m => menageByOrdre.set(m.ordre, m));

    const lotTotals: Record<LotKey, number> = { A: 0, B: 0, C: 0 };
    const lotFait: Record<LotKey, number> = { A: 0, B: 0, C: 0 };

    Object.entries(entries).forEach(([key, entry]) => {
      const ordre = Number(key);
      const m = menageByOrdre.get(ordre);

      LOT_KEYS.forEach(lot => {
        const lotEntry = entry[lot];
        const label = m ? `${m.nom} (#${ordre})` : `Ménage #${ordre}`;

        lotTotals[lot]++;
        if (lotEntry.status === 'fait') lotFait[lot]++;

        if (isBloque(lotEntry.status)) {
          result.push({
            type: 'bloque',
            severity: 'high',
            title: `${label} — Bloqué Lot ${lot}`,
            detail: STATUS_MAP[lotEntry.status]?.label || lotEntry.status,
            lot,
            ordre,
          });
        }

        if (lotEntry.status === 'non_conforme') {
          result.push({
            type: 'non_conforme',
            severity: 'medium',
            title: `${label} — Non conforme Lot ${lot}`,
            detail: 'Résultat non conforme à reprendre',
            lot,
            ordre,
          });
        }

        if (lotEntry.updatedAt && daysSince(lotEntry.updatedAt) >= delayDays && lotEntry.status !== 'fait') {
          result.push({
            type: 'retard',
            severity: 'low',
            title: `${label} — Retard Lot ${lot}`,
            detail: `Inactif depuis ${daysSince(lotEntry.updatedAt)} j. (${STATUS_MAP[lotEntry.status]?.label || lotEntry.status})`,
            lot,
            ordre,
          });
        }
      });

      if (!entry.conforme) {
        result.push({
          type: 'non_conforme',
          severity: 'medium',
          title: `${m ? m.nom : `Ménage #${ordre}`} — Global non conforme`,
          detail: 'Marqué non conforme globalement',
          ordre,
        });
      }
    });

    LOT_KEYS.forEach(lot => {
      if (lotTotals[lot] > 0 && lotFait[lot] === 0) {
        result.push({
          type: 'lot_inactif',
          severity: 'low',
          title: `Lot ${lot} — Aucune réalisation`,
          detail: `0/${lotTotals[lot]} ménages complétés`,
          lot,
        });
      }
    });

    return result;
  }, [entries, menages, alertConfig]);

  const grouped = useMemo(() => {
    const map: Record<string, AlertItem[]> = { high: [], medium: [], low: [] };
    alerts.forEach(a => map[a.severity].push(a));
    return map;
  }, [alerts]);

  const sevLabel: Record<string, string> = {
    high: 'Critique',
    medium: 'Moyen',
    low: 'Info',
  };

  const sevColor: Record<string, string> = {
    high: 'bg-red-50 border-red-200',
    medium: 'bg-amber-50 border-amber-200',
    low: 'bg-blue-50 border-blue-200',
  };

  const sevBadge: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-blue-100 text-blue-700',
  };

  const typeIcon: Record<string, string> = {
    bloque: '⛔',
    non_conforme: '⚠️',
    retard: '🕐',
    lot_inactif: '📭',
  };

  if (alertConfig && !alertConfig.enabled) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
          <span className="text-xs text-slate-400">Les alertes sont désactivées.</span>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
          <div className="text-lg mb-1">✅</div>
          <span className="text-xs font-semibold text-slate-600">Aucune alerte calculée</span>
          <p className="text-[11px] text-slate-400 mt-1">Tous les ménages sont dans les normes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Alertes calculées</h3>
        <p className="text-[11px] text-slate-400 mb-4">
          {alerts.length} alerte{alerts.length > 1 ? 's' : ''} détectée{alerts.length > 1 ? 's' : ''} sur les données de terrain.
        </p>

        <div className="space-y-4">
          {(['high', 'medium', 'low'] as const).map(sev => {
            const items = grouped[sev];
            if (items.length === 0) return null;
            return (
              <div key={sev}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${sevBadge[sev]}`}>
                    {sevLabel[sev]}
                  </span>
                  <span className="text-[11px] text-slate-400">({items.length})</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <div
                      key={`${item.type}-${item.lot || ''}-${item.ordre || ''}-${i}`}
                      className={`border rounded-lg p-3 flex items-start gap-2 ${sevColor[sev]}`}
                    >
                      <span className="text-sm mt-0.5">{typeIcon[item.type]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-700">{item.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.detail}</div>
                      </div>
                      {item.lot && (
                        <span className="text-[10px] font-bold text-slate-400 bg-white/60 px-2 py-0.5 rounded shrink-0">
                          Lot {item.lot}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ComputedAlertsView.displayName = 'ComputedAlertsView';
export default ComputedAlertsView;
