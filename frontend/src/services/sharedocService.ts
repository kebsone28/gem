import api from '../api/client';

export interface SharedDocument {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  uploadedById: string;
  uploadedAt: string;
  updatedAt: string;
  isPublic: boolean;
  accessLevel: 'ORG' | 'PROJECT' | 'PRIVATE';
  description?: string;
  uploadedBy?: {
    id: string;
    name: string;
  };
  _count?: {
    children: number;
  };
  versions?: DocumentVersion[];
  children?: SharedDocument[];
}

export interface DocumentVersion {
  id: string;
  uploadedAt: string;
  changeLog: string;
  size: number;
  uploadedBy: {
    id: string;
    name: string;
  };
}

export interface SharedocListOptions {
  folderId?: string | null;
  search?: string;
  page?: number;
  limit?: number;
}

export const sharedocService = {
  async getDocuments(options: SharedocListOptions = {}) {
    const params = new URLSearchParams();
    if (options.folderId) params.append('folderId', options.folderId);
    if (options.search) params.append('search', options.search);
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());

    const response = await api.get(`/sharedoc?${params.toString()}`);
    return response.data;
  },

  async createFolder(name: string, parentFolderId: string | null = null) {
    const response = await api.post(`/sharedoc/folder`, {
      name,
      parentFolderId
    });
    return response.data;
  },

  async uploadDocument(file: File, folderId: string | null = null, description: string = '') {
    const formData = new FormData();
    formData.append('document', file);
    if (folderId) formData.append('folderId', folderId);
    if (description) formData.append('description', description);

    const response = await api.post(`/sharedoc/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  async deleteDocument(id: string) {
    const response = await api.delete(`/sharedoc/${id}`);
    return response.data;
  },

  async downloadDocument(id: string) {
    const response = await api.get(`/sharedoc/${id}/download`);
    return response.data;
  }
};
