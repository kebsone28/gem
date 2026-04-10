import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import { validateOrganizationConfig } from '../../services/configValidation.service.js';

/**
 * Met à jour la configuration JSON de l'organisation
 * Seulement pour les ADMIN_PROQUELEC
 */
export const updateConfig = async (req, res) => {
    try {
        const { organizationId, id: userId, role } = req.user;
        const { config } = req.body;

        if (role !== 'ADMIN_PROQUELEC') {
            return res.status(403).json({ error: 'Seul l\'administrateur peut modifier la config globale.' });
        }

        // 1. Validation du Schéma de Configuration
        const { error, value: validatedConfig } = validateOrganizationConfig(config);
        if (error) {
            return res.status(400).json({ 
                error: 'Configuration invalide', 
                details: error.details.map(d => d.message) 
            });
        }

        // 2. Récupérer la config actuelle pour fusionner proprement (Deep Merge partiel)
        const org = await prisma.organization.findUnique({
            where: { id: organizationId }
        });

        const newConfig = {
            ...(org.config || {}),
            ...validatedConfig
        };

        const updated = await prisma.organization.update({
            where: { id: organizationId },
            data: { config: newConfig }
        });

        // 3. Audit Log automatique (déjà géré par Prisma Middleware, mais on peut ajouter du détail ici)
        await tracerAction({
            userId,
            organizationId,
            action: 'UPDATE_ORG_CONFIG_MANUAL',
            resource: 'Organization',
            resourceId: organizationId,
            details: { updatedKeys: Object.keys(config) }
        });

        res.json({ message: 'Configuration mise à jour avec succès', config: updated.config });
    } catch (error) {
        console.error('Update org config error:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la mise à jour' });
    }
};

/**
 * Récupère la config actuelle (si besoin de refresh)
 */
export const getConfig = async (req, res) => {
    try {
        const { organizationId } = req.user;
        
        if (!organizationId) {
            console.warn('⚠️ [ORG] organizationId missing in req.user');
            return res.json({ name: 'PROQUELEC', config: {} });
        }

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { config: true, name: true }
        });

        if (!org) {
            return res.json({ name: 'PROQUELEC', config: {} });
        }

        res.json(org);
    } catch (error) {
        console.error('❌ [ORG] getConfig error:', error);
        res.status(200).json({ name: 'PROQUELEC', config: {} }); // On renvoie 200 avec config vide pour éviter de bloquer l'UI
    }
};
