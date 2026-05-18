
import { createNotification } from './notificationService';
import logger from '../utils/logger';
import type { AuthUser, PolicyReasonType } from '../core/security/types';

/**
 * 🚨 Security Alert Service
 * Detects suspicious behavior and triggers system-wide alerts
 */

interface SecurityMonitor {
  failedAttempts: number;
  lastAttempt: number;
  resources: Set<string>;
}

// In-memory monitor (Reset on page reload for frontend, but persisted via audit logs)
const MONITORS = new Map<string, SecurityMonitor>();

const THRESHOLD = 5; // Alert after 5 failed attempts
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes window

export const securityAlertService = {
  /**
   * 🔍 Track a failed access attempt
   */
  async trackFailure(user: AuthUser, action: string, resourceId: string, reason?: PolicyReasonType) {
    const now = Date.now();
    const key = `${user.id}_${action}`;
    
    let monitor = MONITORS.get(key);
    
    // Reset if window expired
    if (monitor && (now - monitor.lastAttempt > WINDOW_MS)) {
      monitor = undefined;
    }

    if (!monitor) {
      monitor = { failedAttempts: 0, lastAttempt: now, resources: new Set() };
    }

    monitor.failedAttempts++;
    monitor.lastAttempt = now;
    monitor.resources.add(resourceId);
    
    MONITORS.set(key, monitor);

    // 🚩 Trigger alert if threshold reached
    if (monitor.failedAttempts >= THRESHOLD) {
      await this.triggerSecurityAlert(user, action, monitor);
    }
  },

  /**
   * 📢 Trigger a formal security alert notification
   */
  async triggerSecurityAlert(user: AuthUser, action: string, monitor: SecurityMonitor) {
    const message = `Tentatives d'accès non-autorisées répétées (${monitor.failedAttempts}) par ${user.email} sur l'action ${action}.`;
    
    logger.warn(`🚨 [SECURITY_ALERT] ${message}`);

    await createNotification({
      userId: 'SYSTEM_ADMIN', // Notification pour les admins
      title: '⚠️ Alerte Sécurité Critique',
      message,
      type: 'critical',
      module: 'SECURITY',
      severity: 'high',
      dedupKey: `security_alert_${user.id}_${action}`,
    });

    // Optionnel: On peut aussi envoyer un log distant ici
  }
};
