import { db } from '../store/db';
import type { MissionNotification } from '../store/db';

/**
 * Service de gestion des notifications (Approbations, Rejets, Alertes)
 */

export const createNotification = async (
  notif: Omit<MissionNotification, 'id' | 'createdAt' | 'read' | 'archived'> & {
    dedupKey?: string; // 🔑 Clé facultative pour éviter les doublons métier
  }
) => {
  const { dedupKey, ...notifData } = notif;

  // 🔍 Vérifier si une notification similaire existe déjà (déduplication)
  if (dedupKey) {
    const existingNotif = await (db.notifications as any)
      .where('dedupKey')
      .equals(dedupKey)
      .first()
      .catch(() => null);

    if (existingNotif && !existingNotif.read) {
      // 🔄 Mettre à jour la notification existante au lieu de créer un doublon
      await db.notifications.update(existingNotif.id, {
        ...notifData,
        createdAt: new Date().toISOString(), // Remonter en haut
      });
      return existingNotif;
    }
  }

  // ✨ Créer une nouvelle notification
  const newNotif: MissionNotification & { dedupKey?: string } = {
    ...notifData,
    dedupKey, // Stocker la clé pour déduplication future
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
    archived: false,
  };

  await db.notifications.add(newNotif as any);
  return newNotif;
};

export const getNotifications = async (projectId?: string) => {
  try {
    if (projectId) {
      return await db.notifications
        .where('projectId')
        .equals(projectId)
        .reverse()
        .sortBy('createdAt');
    }
    return await db.notifications.reverse().sortBy('createdAt');
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return [];
  }
};

export const markAsRead = async (id: string) => {
  await db.notifications.update(id, { read: true });
};

export const archiveNotification = async (id: string) => {
  await db.notifications.update(id, { archived: true });
};

export const deleteNotification = async (id: string) => {
  await db.notifications.delete(id);
};

export const clearAllNotifications = async () => {
  await db.notifications.clear();
};
