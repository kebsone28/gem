import apiClient from '../api/client';

export interface MESRecord {
  id: string;
  avisNumber: string;
  meterNumber: string;
  poste: string;
  zone: string;
  type: 'MONO' | 'TRI';
  nature: 'POSE' | 'BRANCHEMENT_POSE';
  cable?: string;
  ct70?: boolean;
  pa?: boolean;
  agent: string;
  date: string;
  observations?: string;
  status: 'RECU' | 'PROGRAMME' | 'EN_COURS' | 'REALISE' | 'CONTROLE' | 'VALIDE' | 'FACTURE' | 'PAYE';
  prestataire: 'PROQUELEC' | 'UMSAT' | 'AUTRE';
  photos?: string[];
  gpsLat?: number;
  gpsLng?: number;
  clientSignature?: string;
  controlled?: boolean;
  controllerId?: string;
  controlDate?: string;
  checklist?: Record<string, boolean>;
  validated?: boolean;
  validatorId?: string;
  validationDate?: string;
  factured?: boolean;
  factureNumber?: string;
  factureDate?: string;
  amount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MESStats {
  total: number;
  poseMono: number;
  poseTri: number;
  branchementPoseMono: number;
  branchementPoseTri: number;
  enCours: number;
  realises: number;
  controles: number;
  valides: number;
  tauxConformite: number;
}

export interface MESFilters {
  prestataire?: string;
  status?: string;
  month?: string;
  search?: string;
  zone?: string;
  poste?: string;
}

export const mesAPI = {
  // Récupérer tous les enregistrements MES
  async getRecords(filters: MESFilters = {}): Promise<{ records: MESRecord[] }> {
    const params = new URLSearchParams();
    if (filters.prestataire) params.append('prestataire', filters.prestataire);
    if (filters.status) params.append('status', filters.status);
    if (filters.month) params.append('month', filters.month);
    if (filters.search) params.append('search', filters.search);
    if (filters.zone) params.append('zone', filters.zone);
    if (filters.poste) params.append('poste', filters.poste);

    const response = await apiClient.get(`/api/mes/records?${params.toString()}`);
    return response.data;
  },

  // Récupérer un enregistrement MES par ID
  async getRecordById(id: string): Promise<MESRecord> {
    const response = await apiClient.get(`/api/mes/records/${id}`);
    return response.data;
  },

  // Créer un nouvel enregistrement MES
  async createRecord(data: Partial<MESRecord>): Promise<MESRecord> {
    const response = await apiClient.post('/api/mes/records', data);
    return response.data;
  },

  // Mettre à jour un enregistrement MES
  async updateRecord(id: string, data: Partial<MESRecord>): Promise<MESRecord> {
    const response = await apiClient.patch(`/api/mes/records/${id}`, data);
    return response.data;
  },

  // Supprimer un enregistrement MES
  async deleteRecord(id: string): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/api/mes/records/${id}`);
    return response.data;
  },

  // Mettre à jour le statut d'un enregistrement MES
  async updateStatus(id: string, status: string): Promise<MESRecord> {
    const response = await apiClient.patch(`/api/mes/records/${id}/status`, { status });
    return response.data;
  },

  // Valider un enregistrement MES
  async validateRecord(id: string, validatorId?: string): Promise<MESRecord> {
    const response = await apiClient.post(`/api/mes/records/${id}/validate`, { validatorId });
    return response.data;
  },

  // Contrôler un enregistrement MES
  async controlRecord(id: string, controllerId: string, checklist: Record<string, boolean>): Promise<MESRecord> {
    const response = await apiClient.post(`/api/mes/records/${id}/control`, { controllerId, checklist });
    return response.data;
  },

  // Récupérer les statistiques MES
  async getStats(filters: MESFilters = {}): Promise<MESStats> {
    const params = new URLSearchParams();
    if (filters.month) params.append('month', filters.month);
    if (filters.prestataire) params.append('prestataire', filters.prestataire);

    const response = await apiClient.get(`/api/mes/stats?${params.toString()}`);
    return response.data;
  },

  // Importer depuis Excel
  async importFromExcel(file: File): Promise<{ success: boolean; imported: number; errors: number; details: string[] }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/api/mes/import/excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Exporter vers Excel
  async exportToExcel(filters: MESFilters = {}): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters.prestataire) params.append('prestataire', filters.prestataire);
    if (filters.status) params.append('status', filters.status);
    if (filters.month) params.append('month', filters.month);

    const response = await apiClient.get(`/api/mes/export/excel?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Récupérer les zones disponibles
  async getZones(): Promise<{ zones: string[] }> {
    const response = await apiClient.get('/api/mes/zones');
    return response.data;
  },

  // Récupérer les postes disponibles
  async getPostes(): Promise<{ postes: string[] }> {
    const response = await apiClient.get('/api/mes/postes');
    return response.data;
  },

  // Récupérer les agents disponibles
  async getAgents(prestataire?: string): Promise<{ agents: string[] }> {
    const params = new URLSearchParams();
    if (prestataire) params.append('prestataire', prestataire);

    const response = await apiClient.get(`/api/mes/agents?${params.toString()}`);
    return response.data;
  },
};

export default mesAPI;
