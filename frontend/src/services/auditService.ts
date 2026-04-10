import { db } from '../store/db';
import type { User, AuditLog } from '../utils/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 🛡️ Audit Service: Handles system-wide security logging
 */
export const auditService = {
    /**
     * ✍️ Log a critical security or business action
     */
    async logAction(
        user: User,
        action: string,
        module: string,
        details: string,
        severity: 'info' | 'warning' | 'critical' = 'info'
    ) {
        const log: AuditLog = {
            id: uuidv4(),
            userId: user.id,
            userName: user.name,
            action,
            module,
            details,
            timestamp: new Date().toISOString(),
            severity
        };

        try {
            await db.audit_logs.add(log);
            console.log(`🛡️ [AUDIT] ${action} recorded for ${user.name}`);
        } catch (error) {
            console.error('❌ [AUDIT_ERROR] Failed to record log:', error);
        }
    },

    /**
     * 📊 Get the last N logs for the dashboard feed
     */
    async getLastLogs(limit: number = 10) {
        try {
            return await db.audit_logs
                .orderBy('timestamp')
                .reverse()
                .limit(limit)
                .toArray();
        } catch (error) {
            console.error('❌ [AUDIT_ERROR] Failed to fetch logs:', error);
            return [];
        }
    },

    /**
     * 🔍 Filter logs by user or module
     */
    async getLogsByUser(userId: string) {
        return await db.audit_logs
            .where('userId')
            .equals(userId)
            .sortBy('timestamp');
    }
};
