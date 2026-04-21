/**
 * Hook pour la capture de photos optimisée terrain
 * - Accès caméra
 * - Compression automatique
 * - Mode hors-ligne
 */
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface UseTerrainPhotoOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  onUpload?: (file: File) => Promise<string>;
}

interface UseTerrainPhotoReturn {
  capturePhoto: () => Promise<File | null>;
  selectFromGallery: () => Promise<File | null>;
  isCapturing: boolean;
  error: string | null;
}

export const useTerrainPhoto = (options: UseTerrainPhotoOptions = {}) => {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.8, onUpload } = options;

  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Compresse une image pour réduire la taille
   */
  const compressImage = useCallback(
    async (file: File): Promise<File> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            // Calculer les nouvelles dimensions
            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                } else {
                  resolve(file);
                }
              },
              'image/jpeg',
              quality
            );
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    },
    [maxWidth, maxHeight, quality]
  );

  /**
   * Capture une photo depuis la caméra
   */
  const capturePhoto = useCallback(async (): Promise<File | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      // Vérifier si l'appareil supporte l'accès caméra
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'accès caméra n'est pas disponible sur cet appareil");
      }

      // Demander l'accès à la caméra
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Caméra arrière优先
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      // Créer un élément vidéo pour capturer le frame
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Capturer le frame actuel
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      // Arrêter le stream
      stream.getTracks().forEach((track) => track.stop());

      // Convertir en blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality);
      });

      // Créer le fichier
      const file = new File([blob], `terrain_${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      // Compresser si nécessaire
      const compressed = await compressImage(file);

      toast.success('📸 Photo capturée!');
      return compressed;
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors de la capture';
      setError(errorMsg);
      toast.error(`❌ ${errorMsg}`);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [compressImage, quality]);

  /**
   * Sélectionner une photo depuis la galerie
   */
  const selectFromGallery = useCallback(async (): Promise<File | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      // Créer un input file caché
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // Prioriser caméra sur mobile

      return new Promise((resolve) => {
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const compressed = await compressImage(file);
            toast.success('📷 Photo sélectionnée!');
            resolve(compressed);
          } else {
            resolve(null);
          }
          setIsCapturing(false);
        };

        input.onerror = () => {
          setError('Erreur lors de la sélection');
          setIsCapturing(false);
          resolve(null);
        };

        input.click();
      });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sélection');
      return null;
    }
  }, [compressImage]);

  return {
    capturePhoto,
    selectFromGallery,
    isCapturing,
    error,
  };
};

/**
 * Hook pour le mode hors-ligne terrain
 */
export const useTerrainOffline = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingActions, setPendingActions] = useState<any[]>([]);

  // Écouter les événements online/offline
  useState(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  /**
   * Ajouter une action en attente (pour sync hors-ligne)
   */
  const addPendingAction = useCallback((action: any) => {
    setPendingActions((prev) => [...prev, { ...action, timestamp: Date.now() }]);
  }, []);

  /**
   * Synchroniser les actions en attente
   */
  const syncPendingActions = useCallback(async () => {
    // Logique de synchronisation à implémenter
    console.log('Actions en attente:', pendingActions);
  }, [pendingActions]);

  return {
    isOffline,
    pendingActions,
    addPendingAction,
    syncPendingActions,
  };
};

/**
 * Hook pour les快速 actions terrain
 */
export const useQuickActions = () => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { id: 'photo', label: '📸 Photo', icon: '📸' },
    { id: 'status', label: '✅ Statut', icon: '✅' },
    { id: 'note', label: '📝 Note', icon: '📝' },
    { id: 'alert', label: '⚠️ Alerte', icon: '⚠️' },
    { id: 'navigate', label: '🧭 Naviguer', icon: '🧭' },
    { id: 'call', label: '📞 Appeler', icon: '📞' },
  ];

  return { actions, isOpen, setIsOpen };
};
