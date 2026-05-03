import api from '../api/client';
import logger from '../utils/logger';

/**
 * Uploads a file to the server's storage
 * Falls back to local disk in dev, or S3 in production
 */
export const uploadFile = async (file: File): Promise<{ url: string; key: string } | null> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data && response.data.url) {
      return {
        url: response.data.url,
        key: response.data.key,
      };
    }
    
    return null;
  } catch (err) {
    logger.error('Failed to upload file:', err);
    return null;
  }
};
