import prisma from '../../core/utils/prisma.js';

/**
 * @desc    Get all regions for selection
 * @route   GET /api/teams/regions
 */
export const getRegions = async (req, res) => {
    try {
        const regions = await prisma.region.findMany({
            orderBy: { name: 'asc' }
        });
        res.json({ regions });
    } catch (error) {
        console.error('Get regions error:', error);
        res.status(500).json({ error: 'Server error while fetching regions' });
    }
};
