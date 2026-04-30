import apiClient from '../api/client';
import type { PVType } from './ai/PVAIEngine';

export interface ServerPVRecord {
  id: string;
  householdId: string;
  projectId?: string | null;
  type: PVType;
  content?: string | null;
  createdBy?: string | null;
  createdAt: string;
  metadata?: {
    numeroordre?: string;
    recommended?: boolean;
    manualTeam?: string;
    manualDescription?: string;
  };
}

export interface PVListParams {
  projectId?: string | null;
  householdId?: string;
  type?: PVType | 'ALL';
}

export const pvService = {
  async list(params: PVListParams = {}): Promise<ServerPVRecord[]> {
    const response = await apiClient.get('/pvs', {
      params: {
        projectId: params.projectId || undefined,
        householdId: params.householdId,
        type: params.type && params.type !== 'ALL' ? params.type : undefined,
      },
    });
    return response.data?.data || [];
  },

  async upsert(payload: Partial<ServerPVRecord> & { householdId: string; type: PVType }) {
    const response = await apiClient.post('/pvs', payload);
    return response.data?.data as ServerPVRecord;
  },

  async delete(id: string) {
    await apiClient.delete(`/pvs/${id}`);
  },

  async resetHousehold(householdId: string) {
    await apiClient.delete(`/pvs/household/${householdId}`);
  },

  async clear(projectId?: string | null) {
    await apiClient.delete('/pvs/clear', {
      params: { projectId: projectId || undefined },
    });
  },
};

export default pvService;
