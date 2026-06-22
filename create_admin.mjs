/**
 * ⚠️ SCRIPT DÉPRÉCIÉ — Utiliser les variables d'environnement BOOTSTRAP_* à la place
 * 
 * Ce script est conservé uniquement pour la compatibilité ascendante.
 * Ne PAS utiliser en production.
 * 
 * Privilégier le mécanisme d'admin bootstrap dans server.js qui utilise
 * les variables d'environnement : BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD,
 * BOOTSTRAP_ADMIN_SECURITY_ANSWER.
 */

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createAdmin() {
    try {
        const password = process.env.ADMIN_PASSWORD || 'change_me_in_production';
        const answer2FA = process.env.ADMIN_2FA_ANSWER || 'change_me_in_production';

        if (password === 'change_me_in_production' || answer2FA === 'change_me_in_production') {
            console.error('❌ Veuillez définir ADMIN_PASSWORD et ADMIN_2FA_ANSWER dans les variables d\'environnement');
            process.exit(1);
        }

        console.log('🌱 Création de l\'admin...');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const answerHash = await bcrypt.hash(answer2FA.toLowerCase(), salt);

        let org = await prisma.organization.findFirst({ where: { name: 'PROQUELEC' } });
        if (!org) {
            org = await prisma.organization.create({ data: { name: 'PROQUELEC' } });
        }

        const existing = await prisma.user.findUnique({ where: { email: 'admingem' } });
        if (existing) {
            await prisma.user.delete({ where: { email: 'admingem' } });
        }

        const admin = await prisma.user.create({
            data: {
                email: 'admingem',
                passwordHash,
                name: 'Administrateur PROQUELEC',
                roleLegacy: 'ADMIN_PROQUELEC',
                organizationId: org.id,
                requires2FA: true,
                securityQuestion: 'Votre référence spirituelle',
                securityAnswerHash: answerHash,
            }
        });

        console.log('✅ Admin créé avec succès!');
        console.log('   Login: admingem');
        console.log('   Password: [défini via variable d\'environnement]');
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();