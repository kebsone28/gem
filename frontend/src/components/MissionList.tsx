import React, { useMemo, useState } from 'react';
import './MissionList.css';
import { exportMissionsCSV } from '../utils/missionExport';

export type Mission = {
  id: string;
  title: string;
  location?: string;
  status?: 'online' | 'dft' | 'att' | 'off' | 'completed' | 'draft';
  createdAt: string; // ISO
  updatedAt?: string;
  history?: Array<{ when: string; by: string; action: string; note?: string }>;
};

type Props = {
  missions: Mission[];
};

function getYear(iso?: string) {
  if (!iso) return 'unknown';
  try {
    return new Date(iso).getFullYear().toString();
  } catch {
    return 'unknown';
  }
}

export const MissionList: React.FC<Props> = ({ missions }) => {
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [selectedHistory, setSelectedHistory] = useState<Mission | null>(null);
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest');

  const grouped = useMemo(() => {
    const map = new Map<string, Mission[]>();
    const items = [...missions];
    if (sort === 'newest') items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (sort === 'oldest') items.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    if (sort === 'title') items.sort((a, b) => a.title.localeCompare(b.title));

    for (const m of items) {
      const y = getYear(m.createdAt);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [missions, sort]);

  function toggleYear(y: string) {
    setExpandedYears(prev => ({ ...prev, [y]: !prev[y] }));
  }

  return (
    <div className="mission-list" role="region" aria-label="Liste des missions">
      <div className="mission-list-header">
        <div className="mission-list-title">Missions</div>
        <div className="mission-list-controls">
          <label className="sr-only">Trier</label>
          <select aria-label="Trier" value={sort} onChange={e => setSort(e.target.value as any)}>
            <option value="newest">Plus récentes</option>
            <option value="oldest">Plus anciennes</option>
            <option value="title">Par titre</option>
          </select>
          <button className="btn btn-sm" onClick={() => exportMissionsCSV(missions)} aria-label="Exporter CSV">
            Exporter CSV
          </button>
        </div>
      </div>

      <div className="mission-list-body">
        {grouped.map(([year, items]) => (
          <section key={year} className="mission-year">
            <header className="mission-year-header">
              <button
                className="mission-year-toggle"
                onClick={() => toggleYear(year)}
                aria-expanded={!!expandedYears[year]}
                aria-controls={`year-${year}`}
              >
                <strong>{year}</strong> <span className="muted">({items.length})</span>
              </button>
            </header>
            <div id={`year-${year}`} className={`mission-year-list ${expandedYears[year] ? 'expanded' : 'collapsed'}`}>
              {items.map(m => (
                <div key={m.id} className="mission-item" tabIndex={0} role="article" aria-labelledby={`mission-${m.id}-title`}>
                  <div className="mission-dot" aria-hidden />
                  <div className="mission-main">
                    <div id={`mission-${m.id}-title`} className="mission-title">{m.title}</div>
                    <div className="mission-sub">{m.location || '—'} • {new Date(m.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="mission-actions">
                    <button className="btn-ghost" onClick={() => setSelectedHistory(m)} aria-label={`Historique ${m.title}`}>Historique</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectedHistory && (
        <div className="mission-history-modal" role="dialog" aria-modal="true" aria-label={`Historique de ${selectedHistory.title}`}>
          <div className="mission-history-panel">
            <header>
              <h3>Historique — {selectedHistory.title}</h3>
              <button className="btn-ghost" onClick={() => setSelectedHistory(null)} aria-label="Fermer">✕</button>
            </header>
            <div className="mission-history-list">
              {selectedHistory.history && selectedHistory.history.length ? (
                selectedHistory.history.map((h, i) => (
                  <div key={i} className="history-row">
                    <div className="history-date">{new Date(h.when).toLocaleString()}</div>
                    <div className="history-action"><strong>{h.action}</strong> — {h.by}</div>
                    {h.note && <div className="history-note">{h.note}</div>}
                  </div>
                ))
              ) : (
                <div className="muted">Aucun historique disponible</div>
              )}
            </div>
          </div>
          <div className="mission-history-backdrop" onClick={() => setSelectedHistory(null)} />
        </div>
      )}
    </div>
  );
};

export default MissionList;
