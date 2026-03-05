import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

// @desc    Get all teams for an organization
// @route   GET /api/teams
export const getTeams = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId } = req.query;

        const where = {
            organizationId,
            deletedAt: null
        };

        if (projectId) {
            where.organizationId = organizationId; // In Prisma model, Team has organizationId
            // If we want teams of a project, the schema doesn't have a direct link in Team model?
            // Wait, Team in schema.prisma has organizationId but no projectId?
            /*
            model Team {
              id             String       @id @default(uuid())
              organizationId String
              organization   Organization @relation(fields: [organizationId], references: [id])
              name           String
              type           String
              status         String
              version        Int          @default(1)
              updatedAt      DateTime     @updatedAt
              deletedAt      DateTime?
            }
            */
            // The legacy SQL had project_id. 
            // Since the current prisma schema is missing it, I'll filter by organization only for now
            // or I could update the schema but I'm careful with schema changes if not asked.
        }

        const teams = await prisma.team.findMany({
            where,
            orderBy: { name: 'asc' }
        });

        res.json({ teams });
    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ error: 'Server error while fetching teams' });
    }
};

// @desc    Create new team
// @route   POST /api/teams
export const createTeam = async (req, res) => {
    try {
        const { name, type } = req.body;
        const { organizationId } = req.user;

        const team = await prisma.team.create({
            data: {
                name,
                type: type || 'INSTALLATION',
                status: 'active',
                organizationId
            }
        });

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'CREATION_EQUIPE',
            resource: 'Équipe',
            resourceId: team.id,
            details: { name, type: team.type },
            req
        });

        res.status(201).json(team);
    } catch (error) {
        console.error('Create team error:', error);
        res.status(500).json({ error: 'Server error while creating team' });
    }
};
