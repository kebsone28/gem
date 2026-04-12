import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';

// @desc    Determine target sizing (teams needed) based on constraints
// @route   POST /api/sizing/recommend
export const getSizingRecommendation = async (req, res) => {
    try {
        const { targetMonths, totalHouseholds, customRates } = req.body;
        const { organizationId } = req.user;

        // Default constraints (can be overridden by customRates)
        const daysPerMonth = 22; // Working days
        const targetDays = targetMonths * daysPerMonth;

        const rateMaconPerDay = customRates?.macon || 5; 
        const rateLivreurPerDay = customRates?.livreur || 15;
        const rateElecPerDay = customRates?.elec || 10;

        // Calculate REQUIRED force
        // Number of teams = (TotalHouseholds / Operations_per_day) / Target_Days
        const requiredMacons = Math.ceil(totalHouseholds / (rateMaconPerDay * targetDays));
        const requiredLivreurs = Math.ceil(totalHouseholds / (rateLivreurPerDay * targetDays));
        const requiredElecs = Math.ceil(totalHouseholds / (rateElecPerDay * targetDays));

        // Let's see what we currently have
        const currentTeams = await prisma.team.findMany({
            where: { organizationId, status: { in: ['active', 'disponible'] } }
        });

        const currentMacons = currentTeams.filter(t => t.name.toLowerCase().includes('maç') || t.role === 'INSTALLATION').length;
        const currentLivreurs = currentTeams.filter(t => t.name.toLowerCase().includes('livr') || t.role === 'LOGISTICS').length;
        const currentElecs = currentTeams.filter(t => t.name.toLowerCase().includes('elec') || t.role === 'TECHNICAL').length;

        const recommendation = {
            targetDays,
            totalHouseholds,
            required: {
                macons: requiredMacons,
                livreurs: requiredLivreurs,
                elecs: requiredElecs,
            },
            current: {
                macons: currentMacons,
                livreurs: currentLivreurs,
                elecs: currentElecs,
            },
            delta: {
                macons: requiredMacons - currentMacons,
                livreurs: requiredLivreurs - currentLivreurs,
                elecs: requiredElecs - currentElecs,
            }
        };

        res.json(recommendation);
    } catch (error) {
        console.error('Sizing calc error:', error);
        res.status(500).json({ error: 'Server error while calculating sizing' });
    }
};

// @desc    Apply sizing recommendations to instantly scale team resources (Auto-Scale)
// @route   POST /api/sizing/apply
export const applySizingScale = async (req, res) => {
    try {
        const { deltas } = req.body; // { macons: 2, livreurs: 1, elecs: 0 }
        const { organizationId } = req.user;

        // Ensure we are adding and not destructively removing teams for safety
        const toCreateUserAndTeams = [];

        for (const [roleKey, amountToAdd] of Object.entries(deltas)) {
            if (amountToAdd > 0) {
                for (let i = 0; i < amountToAdd; i++) {
                    toCreateUserAndTeams.push(roleKey);
                }
            }
        }

        if (toCreateUserAndTeams.length === 0) {
            return res.json({ message: 'Aucun scale-up nécessaire.', created: 0 });
        }

        // Default password for generated accounts
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('ProquelecA1!', salt);

        const createdEntities = [];
        
        // Count existing teams to assign sequential numbers (e.g. Maçon 1, Maçon 2)
        const currentTeams = await prisma.team.findMany({
            where: { organizationId }
        });
        
        const counts = {
            macons: currentTeams.filter(t => t.name.toLowerCase().includes('maç')).length,
            livreurs: currentTeams.filter(t => t.name.toLowerCase().includes('livr')).length,
            elecs: currentTeams.filter(t => t.name.toLowerCase().includes('elec') || t.name.toLowerCase().includes('élec')).length,
        };

        for (const roleKey of toCreateUserAndTeams) {
            counts[roleKey] += 1; // Increment for the new team sequence
            
            let baseName = roleKey;
            if (roleKey === 'macons') baseName = 'Maçon';
            if (roleKey === 'livreurs') baseName = 'Livreur';
            if (roleKey === 'elecs') baseName = 'Électricien';

            const teamName = `${baseName} ${counts[roleKey]}`;
            
            // Clean dummy email format
            const cleanEmailString = baseName.toLowerCase().replace(/ç/g, 'c').replace(/é/g, 'e');
            const email = `chef-${cleanEmailString}${counts[roleKey]}@gem.local`;

            // 1. Create the User (CHEF_EQUIPE)
            const user = await prisma.user.create({
                data: {
                    name: `Chef ${teamName}`,
                    email: email,
                    passwordHash,
                    roleLegacy: 'CHEF_EQUIPE',
                    organizationId,
                }
            });

            // 2. Create the Team Linked to the User
            const team = await prisma.team.create({
                data: {
                    name: teamName,
                    status: 'disponible',
                    leaderId: user.id,
                    organizationId,
                    role: roleKey === 'macons' ? 'INSTALLATION' : (roleKey === 'livreurs' ? 'LOGISTICS' : 'PREPARATION')
                }
            });

            createdEntities.push({ email, pass: 'ProquelecA1!', teamName });
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
            credentials: createdEntities // Important for the Admin to give to the physical agency!
        });

    } catch (error) {
        console.error('Auto-scale error:', error);
        res.status(500).json({ error: 'Server error while applying auto-scale' });
    }
};
