import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/store/db';

export interface NavBadge {
  count: number;
  type: 'approval' | 'rejection' | 'system';
}

export function useNotificationBadges() {
  const approvalUnread = useLiveQuery(
    () => db.notifications.where({ type: 'approval', read: 0 }).count(),
    []
  ) || 0;

  const rejectionUnread = useLiveQuery(
    () => db.notifications.where({ type: 'rejection', read: 0 }).count(),
    []
  ) || 0;

  const systemUnread = useLiveQuery(
    () => db.notifications.where({ type: 'system', read: 0 }).count(),
    []
  ) || 0;

  const totalUnread = approvalUnread + rejectionUnread + systemUnread;

  return {
    approvalUnread,
    rejectionUnread,
    systemUnread,
    totalUnread,
  };
}
