@echo off
echo 🚀 Création de l'admin...
cd backend
node -e "
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createAdmin() {
    try {
        console.log('🌱 Création de l\'admin...');

        // Générer un mot de passe sécurisé aléatoire
        const password = Math.random().toString(36).slice(-12);
        const answer2FA = 'coran';

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const answerHash = await bcrypt.hash(answer2FA.toLowerCase(), salt);

        // Créer organisation
        let org = await prisma.organization.findFirst({ where: { name: 'PROQUELEC' } });
        if (!org) {
            org = await prisma.organization.create({ data: { name: 'PROQUELEC' } });
        }

        // Supprimer admin existant
        const existing = await prisma.user.findUnique({ where: { email: 'admingem' } });
        if (existing) {
            await prisma.user.delete({ where: { email: 'admingem' } });
        }

        // Créer nouvel admin
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
        console.log('   Mot de passe généré: ' + password);
        console.log('   Réponse 2FA: coran');
        console.log('');
        console.log('⚠️  IMPORTANT: Enregistrez le mot de passe généré !');
        console.log('   Le mot de passe est stocké en hash et ne peut pas être récupéré.');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
"
pause