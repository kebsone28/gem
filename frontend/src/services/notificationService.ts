import { db } from '../store/db';
import type { MissionNotification } from '../store/db';

/**
 * Service de gestion des notifications (Approbations, Rejets, Alertes)
 */

export const createNotification = async (notif: Omit<MissionNotification, 'id' | 'createdAt' | 'read' | 'archived'>) => {
  const newNotif: MissionNotification = {
    ...notif,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    read: false,
    archived: false
  };
  await db.notifications.add(newNotif);
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
    console.error("Error fetching notifications:", err);
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
