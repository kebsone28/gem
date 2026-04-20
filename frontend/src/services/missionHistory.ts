import type { MissionOrderData, MissionMember } from '../pages/mission/core/missionTypes';

export interface MissionSnapshot {
  id: string;
  missionId: string;
  timestamp: number;
  author: string;
  change: MissionChange;
  fullData: Partial<MissionOrderData>;
  members: MissionMember[];
}

export interface MissionChange {
  type: 'created' | 'modified' | 'certified' | 'executed' | 'finalized';
  description: string;
  changedFields?: string[];
}

const STORAGE_KEY_PREFIX = 'mission_history_';

export const saveMissionSnapshot = (
  missionId: string,
  change: MissionChange,
  data: Partial<MissionOrderData>,
  members: MissionMember[],
  author: string = 'System'
): MissionSnapshot => {
  const snapshot: MissionSnapshot = {
    id: `${missionId}_${Date.now()}`,
    missionId,
    timestamp: Date.now(),
    author,
    change,
    fullData: { ...data },
    members: [...members],
  };

  const historyKey = `${STORAGE_KEY_PREFIX}${missionId}`;
  const history = getMissionHistory(missionId);
  history.push(snapshot);

  // Garder max 10 snapshots par mission pour éviter QuotaExceededError
  if (history.length > 10) {
    history.shift();
  }

  try {
    localStorage.setItem(historyKey, JSON.stringify(history));
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      // If full, try to keep only 3 most recent snapshots
      try {
        const minimalHistory = history.slice(-3);
        localStorage.setItem(historyKey, JSON.stringify(minimalHistory));
        console.log('Managed storage quota by reducing history depth to 3.');
      } catch {
        console.warn('LocalStorage fully exhausted, could not even save minimal history.');
      }
    } else {
      console.warn('Failed to save mission snapshot:', e);
    }
  }

  return snapshot;
};

export const getMissionHistory = (missionId: string): MissionSnapshot[] => {
  try {
    const historyKey = `${STORAGE_KEY_PREFIX}${missionId}`;
    const stored = localStorage.getItem(historyKey);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.warn('Failed to load mission history:', e);
    return [];
  }
};

export const restoreMissionSnapshot = (
  missionId: string,
  snapshotId: string
): {
  data: Partial<MissionOrderData>;
  members: MissionMember[];
} | null => {
  const history = getMissionHistory(missionId);
  const snapshot = history.find((s) => s.id === snapshotId);

  if (!snapshot) return null;

  return {
    data: { ...snapshot.fullData },
    members: [...snapshot.members],
  };
};

export const compareMissionSnapshots = (
  snapshot1: MissionSnapshot,
  snapshot2: MissionSnapshot
): {
  field: string;
  oldValue: any;
  newValue: any;
}[] => {
  const differences: any[] = [];

  const data1 = snapshot1.fullData;
  const data2 = snapshot2.fullData;

  // Comparer les champs simples
  const fields = [
    'orderNumber',
    'date',
    'region',
    'startDate',
    'endDate',
    'itineraryAller',
    'itineraryRetour',
    'purpose',
    'transport',
  ] as const;

  fields.forEach((field) => {
    if (data1[field] !== data2[field]) {
      differences.push({
        field,
        oldValue: data1[field],
        newValue: data2[field],
      });
    }
  });

  // Comparer les membres
  if (JSON.stringify(snapshot1.members) !== JSON.stringify(snapshot2.members)) {
    differences.push({
      field: 'members',
      oldValue: snapshot1.members,
      newValue: snapshot2.members,
    });
  }

  // Comparer le planning
  if (JSON.stringify(data1.planning) !== JSON.stringify(data2.planning)) {
    differences.push({
      field: 'planning',
      oldValue: data1.planning,
      newValue: data2.planning,
    });
  }

  return differences;
};

export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const clearMissionHistory = (missionId: string): void => {
  const historyKey = `${STORAGE_KEY_PREFIX}${missionId}`;
  try {
    localStorage.removeItem(historyKey);
  } catch (e) {
    console.warn('Failed to clear mission history:', e);
  }
};
