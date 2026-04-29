import { getAIEngineConfig } from './AIEngineConfig';
import logger from '../../utils/logger';

export interface MissionSageSessionMemory {
  lastIntent?: string;
  lastEntities?: string[];
  lastMetricsViewed?: string[];
  decisionHistory?: string[];
  history: string[];
  contextHistory: { role: 'user' | 'assistant'; content: string }[];
  lastUpdated: number;
}

const MEMORY_KEY = 'gem_mint_memory_';
const MEMORY_TTL_MS = 3_600_000;

function emptyMemory(): MissionSageSessionMemory {
  return { history: [], contextHistory: [], lastUpdated: Date.now() };
}

export function isValidMemory(obj: unknown): obj is MissionSageSessionMemory {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Array.isArray((obj as MissionSageSessionMemory).history) &&
    Array.isArray((obj as MissionSageSessionMemory).contextHistory) &&
    typeof (obj as MissionSageSessionMemory).lastUpdated === 'number'
  );
}

export function getMemory(userId: string): MissionSageSessionMemory {
  const empty = emptyMemory();
  try {
    const raw = localStorage.getItem(MEMORY_KEY + userId);
    if (!raw) return empty;

    const parsed = JSON.parse(raw);
    if (!isValidMemory(parsed)) {
      logger.warn('[MissionSage] Mémoire corrompue, réinitialisation', { userId });
      return empty;
    }

    if (Date.now() - parsed.lastUpdated > MEMORY_TTL_MS) return empty;
    return parsed;
  } catch {
    return empty;
  }
}

export function saveMemory(userId: string, mem: MissionSageSessionMemory): void {
  try {
    mem.lastUpdated = Date.now();
    const maxTurns = getAIEngineConfig().maxHistoryTurns * 2;
    if (mem.contextHistory.length > maxTurns)
      mem.contextHistory = mem.contextHistory.slice(-maxTurns);
    if (mem.history.length > 50) mem.history = mem.history.slice(-50);
    localStorage.setItem(MEMORY_KEY + userId, JSON.stringify(mem));
  } catch (err) {
    logger.warn('[MissionSage] Impossible de sauvegarder la mémoire', { userId, err });
  }
}
