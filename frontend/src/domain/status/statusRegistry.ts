export const STATUS = {
  INELIGIBLE: 'Non éligible',
  NOT_STARTED: 'Non encore installée',
  DELIVERD: 'Livraison effectuée',
  WALLS_DONE: 'Murs terminés',
  NETWORK_DONE: 'Réseau terminé',
  INTERIOR_DONE: 'Intérieur terminé',
  COMPLIANT: 'Contrôle conforme',
  NON_COMPLIANT: 'Non conforme',
  DESIST: 'Désistement',
  REFUSED: 'Refusé',
  ELIGIBLE: 'Eligible',
  STANDBY: 'En attente',
} as const;

export type StatusKey = typeof STATUS[keyof typeof STATUS];

export type StatusMeta = {
  label: string;
  color: string;
  bg: string;
  icon?: string;
  order: number;        // 🔥 CRUCIAL pour offline sync et transitions
  isFinal?: boolean;
};

// Basé sur l'organigramme GEM SAAS
export const STATUS_META: Record<StatusKey, StatusMeta> = {
  [STATUS.INELIGIBLE]: {
    label: STATUS.INELIGIBLE,
    color: 'text-slate-500',
    bg: 'bg-slate-500/10',
    icon: 'dot',
    order: -1,
    isFinal: true,
  },
  [STATUS.DESIST]: {
    label: STATUS.DESIST,
    color: 'text-slate-500',
    bg: 'bg-slate-500/10',
    icon: 'warning',
    order: -1,
    isFinal: true,
  },
  [STATUS.REFUSED]: {
    label: STATUS.REFUSED,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    icon: 'warning',
    order: -1,
    isFinal: true,
  },
  [STATUS.NON_COMPLIANT]: {
    label: STATUS.NON_COMPLIANT,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    icon: 'warning',
    order: -1,
  },
  [STATUS.STANDBY]: {
    label: STATUS.STANDBY,
    color: 'text-slate-500',
    bg: 'bg-slate-500/10',
    icon: 'dot',
    order: 0,
  },
  [STATUS.NOT_STARTED]: {
    label: STATUS.NOT_STARTED,
    color: 'text-slate-500',
    bg: 'bg-slate-500/10',
    icon: 'dot',
    order: 0,
  },
  [STATUS.ELIGIBLE]: {
    label: STATUS.ELIGIBLE,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    icon: 'dot',
    order: 1,
  },
  [STATUS.DELIVERD]: {
    label: STATUS.DELIVERD,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    icon: 'delivery',
    order: 2,
  },
  [STATUS.WALLS_DONE]: {
    label: STATUS.WALLS_DONE,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    icon: 'walls',
    order: 3,
  },
  [STATUS.NETWORK_DONE]: {
    label: STATUS.NETWORK_DONE,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    icon: 'network',
    order: 4,
  },
  [STATUS.INTERIOR_DONE]: {
    label: STATUS.INTERIOR_DONE,
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    icon: 'interior',
    order: 5,
  },
  [STATUS.COMPLIANT]: {
    label: STATUS.COMPLIANT,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    icon: 'check',
    order: 6,
    isFinal: true,
  },
};

