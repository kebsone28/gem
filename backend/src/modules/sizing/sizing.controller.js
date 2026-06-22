import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import logger from '../../utils/logger.js';
import { TEAM_TRADES, DEFAULT_TRADE_RATES, DEFAULT_WORKING_DAYS_PER_MONTH } from '../../core/config/businessRules.js';

// @desc    Determine target sizing (teams needed) based on constraints
// @route   POST /api/sizing/recommend
export const getSizingRecommendation = async (req, res) => {
    try {
        const { targetMonths, totalHouseholds, customRates } = req.body;
        const { organizationId } = req.user;

        const daysPerMonth = DEFAULT_WORKING_DAYS_PER_MONTH;
        const targetDays = targetMonths * daysPerMonth;

        const rateMasonPerDay = customRates?.mason || DEFAULT_TRADE_RATES[TEAM_TRADES.MASON];
        const rateDeliveryPerDay = customRates?.delivery || DEFAULT_TRADE_RATES[TEAM_TRADES.DELIVERY];
        const rateElectricianPerDay = customRates?.electrician || DEFAULT_TRADE_RATES[TEAM_TRADES.ELECTRICIAN];

        const requiredMasons = Math.ceil(totalHouseholds / (rateMasonPerDay * targetDays));
        const requiredDeliveries = Math.ceil(totalHouseholds / (rateDeliveryPerDay * targetDays));
        const requiredElectricians = Math.ceil(totalHouseholds / (rateElectricianPerDay * targetDays));

        const currentTeams = await prisma.team.findMany({
            where: { organizationId, status: { in: ['active', 'disponible'] } }
        });

        const currentMasons = currentTeams.filter(t => t.tradeKey === TEAM_TRADES.MASON).length;
        const currentDeliveries = currentTeams.filter(t => t.tradeKey === TEAM_TRADES.DELIVERY).length;
        const currentElectricians = currentTeams.filter(t => t.tradeKey === TEAM_TRADES.ELECTRICIAN).length;

        const recommendation = {
            targetDays,
            totalHouseholds,
            required: {
                masons: requiredMasons,
                deliveries: requiredDeliveries,
                electricians: requiredElectricians,
            },
            current: {
                masons: currentMasons,
                deliveries: currentDeliveries,
                electricians: currentElectricians,
            },
            delta: {
                masons: requiredMasons - currentMasons,
                deliveries: requiredDeliveries - currentDeliveries,
                electricians: requiredElectricians - currentElectricians,
            }
        };

        res.json(recommendation);
    } catch (error) {
        logger.error('Sizing calc error:', error);
        res.status(500).json({ error: 'Server error while calculating sizing' });
    }
};

// @desc    Apply sizing recommendations to instantly scale team resources (Auto-Scale)
// @route   POST /api/sizing/apply
export const applySizingScale = async (req, res) => {
    try {
        const { deltas } = req.body; // { masons: 2, deliveries: 1, electricians: 0 }
        const { organizationId } = req.user;

        const TRADE_MAP = {
            masons: { tradeKey: TEAM_TRADES.MASON, baseName: 'Maçon', role: 'INSTALLATION' },
            deliveries: { tradeKey: TEAM_TRADES.DELIVERY, baseName: 'Livreur', role: 'LOGISTICS' },
            electricians: { tradeKey: TEAM_TRADES.ELECTRICIAN, baseName: 'Électricien', role: 'TECHNICAL' },
        };

        const toCreateEntries = [];
        for (const [roleKey, amountToAdd] of Object.entries(deltas)) {
            if (amountToAdd > 0 && TRADE_MAP[roleKey]) {
                for (let i = 0; i < amountToAdd; i++) {
                    toCreateEntries.push(roleKey);
                }
            }
        }

        if (toCreateEntries.length === 0) {
            return res.json({ message: 'Aucun scale-up nécessaire.', created: 0 });
        }

        const defaultPassword = process.env.DEFAULT_TEAM_PASSWORD || 'ChangeMe_2024!';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(defaultPassword, salt);

        const createdEntities = [];

        const currentTeams = await prisma.team.findMany({
            where: { organizationId }
        });

        const counts = {};
        for (const key of Object.keys(TRADE_MAP)) {
            counts[key] = currentTeams.filter(t => t.tradeKey === TRADE_MAP[key].tradeKey).length;
        }

        for (const roleKey of toCreateEntries) {
            const trade = TRADE_MAP[roleKey];
            counts[roleKey] += 1;
            const teamName = `${trade.baseName} ${counts[roleKey]}`;
            const cleanEmailBase = trade.baseName.toLowerCase().replace(/ç/g, 'c').replace(/é/g, 'e');
            const email = `chef-${cleanEmailBase}${counts[roleKey]}@ged-os.local`;

            const user = await prisma.user.create({
                data: {
                    name: `Chef ${teamName}`,
                    email,
                    passwordHash,
                    roleLegacy: 'CHEF_EQUIPE',
                    organizationId,
                }
            });

            const team = await prisma.team.create({
                data: {
                    name: teamName,
                    status: 'disponible',
                    leaderId: user.id,
                    organizationId,
                    tradeKey: trade.tradeKey,
                    role: trade.role,
                }
            });

            createdEntities.push({ email, teamName });
        }

        // Audit Log
        await tracerAction({
            userId: req.user.id,
            organizationId,
            action: 'AUTO_SCALE_EQUIPES',
            resource: 'Planification',
            resourceId: 'Scale',
            details: { scaled: createdEntities.length, entities: createdEntities },
            req
        });

        res.json({
            message: `${createdEntities.length} équipes(s) et compte(s) utilisateur(s) ont été créés automatiquement.`,
            created: createdEntities.length,
        });

    } catch (error) {
        logger.error('Auto-scale error:', error);
        res.status(500).json({ error: 'Server error while applying auto-scale' });
    }
};
