import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import apiClient from '../api/client';

export function useOfflineSync() {
    const pendingItems = useLiveQuery(() => db.syncOutbox.where({ status: 'pending' }).toArray());

    useEffect(() => {
        const syncData = async () => {
            if (!navigator.onLine || !pendingItems || pendingItems.length === 0) return;

            console.log(`🔄 [SYNC] Tentative de synchronisation de ${pendingItems.length} éléments...`);

            for (const item of pendingItems) {
                try {
                    // On tente d'utiliser l'apiClient pour renvoyer la requête
                    await apiClient({
                        method: item.method,
                        url: item.endpoint,
                        data: item.payload,
                    });

                    // Si succès, on supprime de l'outbox
                    await db.syncOutbox.delete(item.id!);
                    console.log(`✅ [SYNC] Élément synchronisé : ${item.action}`);
                } catch (error: any) {
                    console.error(`❌ [SYNC] Échec pour ${item.action} :`, error);

                    // Si c'est une erreur 4xx (sauf 429), on considère que c'est une erreur de donnée et on marque en "failed"
                    if (error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
                        await db.syncOutbox.update(item.id!, {
                            status: 'failed',
                            retryCount: (item.retryCount || 0) + 1
                        });
                    }
                    // Si c'est une erreur 500 ou réseau, on laisse en "pending" pour la prochaine tentative
                }
            }
        };

        const handleOnline = () => {
            syncData();
        };

        window.addEventListener('online', handleOnline);

        // On tente aussi la sync au montage si on est déjà en ligne
        if (navigator.onLine) syncData();

        return () => window.removeEventListener('online', handleOnline);
    }, [pendingItems]);

    return {
        pendingCount: pendingItems?.length || 0
    };
}
