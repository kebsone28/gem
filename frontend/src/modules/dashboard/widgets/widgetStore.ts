const STORAGE_KEY = 'dashboard-widget-order';
const CHANGE_EVENT = 'dashboard:widget-order-change';

export interface WidgetItem {
  id: string;
  label: string;
}

const DEFAULT_WIDGETS: WidgetItem[] = [
  { id: 'quick-access', label: 'Accès Rapide DG' },
  { id: 'situation', label: 'Situation du jour' },
  { id: 'global-progress', label: 'Progression Globale' },
  { id: 'team-performance', label: 'Performance Équipes' },
  { id: 'unified-stats', label: 'Tableau Stratégique' },
  { id: 'control-panel', label: 'Pilotage & Alertes' },
  { id: 'ai-chat', label: 'Assistant IA' },
];

export function loadWidgetOrder(): WidgetItem[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as WidgetItem[];
      const savedIds = new Set(parsed.map((w) => w.id));
      const missing = DEFAULT_WIDGETS.filter((w) => !savedIds.has(w.id));
      return [...parsed, ...missing];
    } catch {}
  }
  return [...DEFAULT_WIDGETS];
}

export function saveWidgetOrder(widgets: WidgetItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { widgets } }));
}

export { CHANGE_EVENT };
