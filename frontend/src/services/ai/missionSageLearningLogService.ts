import { db } from '../../store/db';

export interface MissionSageLearningLog {
  id?: number;
  query: string;
  userId: string;
  role: string;
  timestamp: Date;
  context?: string;
}

export const missionSageLearningLogService = {
  async listUnresolved(limit = 25): Promise<MissionSageLearningLog[]> {
    try {
      return await db.ai_learning_logs
        .where('context')
        .equals('rules_fallback')
        .reverse()
        .sortBy('timestamp')
        .then((items) => items.slice(0, limit));
    } catch {
      const items = await db.ai_learning_logs.toArray();
      return items
        .filter((item) => item.context === 'rules_fallback')
        .sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp)))
        .slice(0, limit);
    }
  },
};
