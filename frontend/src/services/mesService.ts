import apiClient from '../api/client';

// Types pour le module MES
export type MESStatus = 'RECU' | 'PROGRAMME' | 'EN_COURS' | 'REALISE' | 'CONTROLE' | 'VALIDE' | 'FACTURE' | 'PAYE';
export type MESType = 'MONO' | 'TRI';
export type MESNature = 'POSE' | 'BRANCHEMENT_POSE';
export type MESPrestataire = 'PROQUELEC' | 'UMSAT' | 'AUTRE';

export interface MESRecord {
  id: string;
  avisNumber: string;
  meterNumber: string;
  poste: string;
  zone: string;
  type: MESType;
  nature: MESNature;
  cable?: string;
  ct70?: boolean;
  pa?: boolean;
  agent: string;
  date: string;
  observations?: string;
  status: MESStatus;
  prestataire: MESPrestataire;
  photos?: string[];
  gps?: { lat: number; lng: number };
  clientSignature?: string;
  createdAt?: string;
  updatedAt?: string;
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
  prestataire?: 'ALL' | MESPrestataire;
  status?: 'ALL' | MESStatus;
  month?: string;
  searchQuery?: string;
  zone?: string;
  poste?: string;
}

export interface MESImportResult {
  success: boolean;
  imported: number;
  errors: number;
  details?: string[];
}

class MESService {
  // Récupérer tous les enregistrements MES
  async getMESRecords(filters?: MESFilters): Promise<MESRecord[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.prestataire && filters.prestataire !== 'ALL') {
        params.append('prestataire', filters.prestataire);
      }
      if (filters?.status && filters.status !== 'ALL') {
        params.append('status', filters.status);
      }
      if (filters?.month) {
        params.append('month', filters.month);
      }
      if (filters?.searchQuery) {
        params.append('search', filters.searchQuery);
      }
      if (filters?.zone) {
        params.append('zone', filters.zone);
      }
      if (filters?.poste) {
        params.append('poste', filters.poste);
      }

      const queryString = params.toString();
      const url = queryString ? `/mes/records?${queryString}` : '/mes/records';
      
      const response = await apiClient.get(url);
      return response.data.records || response.data;
    } catch (error) {
      console.error('[MESService] Error fetching MES records:', error);
      throw error;
    }
  }

  // Récupérer un enregistrement MES par ID
  async getMESRecord(id: string): Promise<MESRecord> {
    try {
      const response = await apiClient.get(`/mes/records/${id}`);
      return response.data;
    } catch (error) {
      console.error('[MESService] Error fetching MES record:', error);
      throw error;
    }
  }

  // Créer un nouvel enregistrement MES
  async createMESRecord(record: Partial<MESRecord>): Promise<MESRecord> {
    try {
      const response = await apiClient.post('/mes/records', record);
      return response.data;
    } catch (error) {
      console.error('[MESService] Error creating MES record:', error);
      throw error;
    }
  }

  // Mettre à jour un enregistrement MES
  async updateMESRecord(id: string, record: Partial<MESRecord>): Promise<MESRecord> {
    try {
      const response = await apiClient.patch(`/mes/records/${id}`, record);
      return response.data;
    } catch (error) {
      console.error('[MESService] Error updating MES record:', error);
      throw error;
    }
  }

  // Supprimer un enregistrement MES
  async deleteMESRecord(id: string): Promise<void> {
    try {
      await apiClient.delete(`/mes/records/${id}`);
    } catch (error) {
      console.error('[MESService] Error deleting MES record:', error);
      throw error;
    }
  }

  // Mettre à jour le statut d'un enregistrement MES
  async updateMESStatus(id: string, status: MESStatus): Promise<MESRecord> {
    try {
      const response = await apiClient.patch(`/mes/records/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('[MESService] Error updating MES status:', error);
      throw error;
    }
  }

  // Récupérer les statistiques MES
  async getMESStats(filters?: MESFilters): Promise<MESStats> {
    try {
      const params = new URLSearchParams();
      if (filters?.month) {
        params.append('month', filters.month);
      }
      if (filters?.prestataire && filters.prestataire !== 'ALL') {
        params.append('prestataire', filters.prestataire);
      }

      const queryString = params.toString();
      const url = queryString ? `/mes/stats?${queryString}` : '/mes/stats';
      
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      console.error('[MESService] Error fetching MES stats:', error);
      throw error;
    }
  }

  // Importer des données depuis Excel
  async importFromExcel(file: File): Promise<MESImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post('/mes/import/excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      console.error('[MESService] Error importing from Excel:', error);
      throw error;
    }
  }

  // Exporter des données vers Excel
  async exportToExcel(filters?: MESFilters): Promise<Blob> {
    try {
      const params = new URLSearchParams();
      if (filters?.prestataire && filters.prestataire !== 'ALL') {
        params.append('prestataire', filters.prestataire);
      }
      if (filters?.status && filters.status !== 'ALL') {
        params.append('status', filters.status);
      }
      if (filters?.month) {
        params.append('month', filters.month);
      }

      const queryString = params.toString();
      const url = queryString ? `/mes/export/excel?${queryString}` : '/mes/export/excel';
      
      const response = await apiClient.get(url, {
        responseType: 'blob',
      });

      return response.data;
    } catch (error) {
      console.error('[MESService] Error exporting to Excel:', error);
      throw error;
    }
  }

  // Récupérer les zones disponibles
  async getZones(): Promise<string[]> {
    try {
      const response = await apiClient.get('/mes/zones');
      return response.data.zones || response.data;
    } catch (error) {
      console.error('[MESService] Error fetching zones:', error);
      throw error;
    }
  }

  // Récupérer les postes disponibles
  async getPostes(): Promise<string[]> {
    try {
      const response = await apiClient.get('/mes/postes');
      return response.data.postes || response.data;
    } catch (error) {
      console.error('[MESService] Error fetching postes:', error);
      throw error;
    }
  }

  // Récupérer les agents disponibles
  async getAgents(prestataire?: MESPrestataire): Promise<string[]> {
    try {
      const params = new URLSearchParams();
      if (prestataire) {
        params.append('prestataire', prestataire);
      }

      const queryString = params.toString();
      const url = queryString ? `/mes/agents?${queryString}` : '/mes/agents';
      
      const response = await apiClient.get(url);
      return response.data.agents || response.data;
    } catch (error) {
      console.error('[MESService] Error fetching agents:', error);
      throw error;
    }
  }

  // Valider un enregistrement MES
  async validateMESRecord(id: string, validatorId: string): Promise<MESRecord> {
    try {
      const response = await apiClient.post(`/mes/records/${id}/validate`, { validatorId });
      return response.data;
    } catch (error) {
      console.error('[MESService] Error validating MES record:', error);
      throw error;
    }
  }

  // Contrôler un enregistrement MES
  async controlMESRecord(id: string, controllerId: string, checklist: Record<string, boolean>): Promise<MESRecord> {
    try {
      const response = await apiClient.post(`/mes/records/${id}/control`, {
        controllerId,
        checklist,
      });
      return response.data;
    } catch (error) {
      console.error('[MESService] Error controlling MES record:', error);
      throw error;
    }
  }
}

export const mesService = new MESService();
export default mesService;
