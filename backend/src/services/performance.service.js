import prisma from '../core/utils/prisma.js';

/**
 * Log a performance event (status change, material use, etc.)
 * This service centralizes performance logging for Proquelec's enterprise dashboard.
 */
export const logPerformance = async ({
    organizationId,
    projectId,
    userId,
    householdId,
    action,
    oldStatus,
    newStatus,
    details = {}
}) => {
    try {
        if (!organizationId || !projectId) {
            console.warn('[PERFORMANCE-SERVICE] Missing organizationId or projectId');
            return null;
        }

        // 1. Resolve Team context
        // For performance tracking, we need to know WHICH team performed the work.
        // We primarily check if the current user is a team leader.
        let teamId = null;
        let tradeKey = null;

        if (userId) {
            const team = await prisma.team.findFirst({
                where: { 
                    leaderId: userId,
                    deletedAt: null 
                },
                select: { id: true, tradeKey: true }
            });
            
            if (team) {
                teamId = team.id;
                tradeKey = team.tradeKey;
            }
        }

        // 2. Create entry in PerformanceLog table
        const log = await prisma.performanceLog.create({
            data: {
                organizationId,
                projectId,
                userId,
                householdId,
                action: action || 'STATUS_CHANGE',
                oldStatus,
                newStatus,
                teamId,
                tradeKey,
                details: details || {},
                timestamp: new Date()
            }
        });

        console.log(`[PERFORMANCE-SERVICE] Logged ${action} for household ${householdId} (Team: ${teamId || 'N/A'})`);
        return log;

    } catch (error) {
        // We log the error but don't throw to prevent breaking the caller's transaction/workflow
        console.error('[PERFORMANCE-SERVICE-ERROR]', error.message);
        return null;
    }
};
