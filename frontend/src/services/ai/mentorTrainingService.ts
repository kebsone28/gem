import apiClient from '../../api/client';

export interface MentorTrainingEntry {
  id: string;
  question: string;
  answer: string;
  normalizedQuestion: string;
  active: boolean;
  lifecycleStatus?: 'active' | 'closed' | 'accepted';
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
}

function normalizeQuestion(value = ''): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const mentorTrainingService = {
  normalizeQuestion,

  async listEntries(): Promise<MentorTrainingEntry[]> {
    const { data } = await apiClient.get('/ai/training');
    return Array.isArray(data) ? data : [];
  },

  async saveEntry(payload: { question: string; answer: string }): Promise<MentorTrainingEntry> {
    const { data } = await apiClient.post('/ai/training', payload);
    return data;
  },

  async closeEntry(entryId: string): Promise<MentorTrainingEntry> {
    const { data } = await apiClient.delete(`/ai/training/${entryId}`);
    return data;
  },

  async acceptEntry(entryId: string): Promise<MentorTrainingEntry> {
    const { data } = await apiClient.patch(`/ai/training/${entryId}/accept`);
    return data;
  },

  async findMatch(question: string): Promise<MentorTrainingEntry | null> {
    if (!normalizeQuestion(question)) return null;
    const { data } = await apiClient.post('/ai/training/match', { question });
    return data || null;
  },
};
