/**
 * 🎨 AI Formatters - Fonctions de formatage standardisées
 * Centralise toutes les fonctions de formatage utilisées dans le système AI
 */

/**
 * Formate une date en français
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/**
 * Formate une date relative (il y a...)
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour} h`;
  if (diffDay < 7) return `il y a ${diffDay} j`;
  return formatDate(d);
}

/**
 * Formate un verdict avec badge
 */
export function formatVerdictBadge(verdict?: string): { label: string; className: string } {
  const verdicts: Record<string, { label: string; className: string }> = {
    'Conforme': {
      label: 'Conforme',
      className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    },
    'Conforme sous réserve': {
      label: 'Conforme sous réserve',
      className: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    },
    'Non conforme': {
      label: 'Non conforme',
      className: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
    },
    'A verifier': {
      label: 'À vérifier',
      className: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    },
  };

  return verdicts[verdict || ''] || {
    label: 'Info',
    className: 'border-white/10 bg-white/5 text-slate-300',
  };
}

/**
 * Formate une sévérité avec badge
 */
export function formatSeverityBadge(severity?: string): { label: string; className: string } {
  const severities: Record<string, { label: string; className: string }> = {
    'critique': {
      label: 'Critique',
      className: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
    },
    'majeure': {
      label: 'Majeure',
      className: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
    },
    'mineure': {
      label: 'Mineure',
      className: 'border-sky-500/30 bg-sky-500/15 text-sky-300',
    },
    'information': {
      label: 'Info',
      className: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
    },
  };

  return severities[severity || ''] || {
    label: 'Info',
    className: 'border-white/10 bg-white/5 text-slate-300',
  };
}

/**
 * Formate un mode IA en label français
 */
export function formatAIModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    'RULES_ONLY': 'Règles statiques uniquement',
    'CLAUDE_ONLY': 'Claude AI uniquement',
    'HYBRID_RULES_FIRST': 'Hybride — Règles en priorité',
    'HYBRID_AI_FIRST': 'Hybride — Claude AI en priorité',
  };
  return labels[mode] || mode;
}

/**
 * Formate un nombre avec séparateurs
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

/**
 * Formate un pourcentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formate une durée en minutes/heures
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Formate un nom de fichier
 */
export function formatFileName(filename: string, maxLength = 30): string {
  if (filename.length <= maxLength) return filename;
  const ext = filename.split('.').pop();
  const name = filename.split('.').slice(0, -1).join('.');
  return `${name.slice(0, maxLength - 5)}...${ext ? `.${ext}` : ''}`;
}

/**
 * Formate un texte pour l'affichage (capitalize)
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Formate un texte en title case
 */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
}
