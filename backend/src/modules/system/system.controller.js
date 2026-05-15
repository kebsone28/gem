import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';

/**
 * Récupère la configuration globale des modules.
 * @route GET /api/admin/modules/config
 */
export const getModulesConfig = async (req, res) => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'global_modules_config' },
    });

    // Si pas de config en DB, on retourne un objet vide (le frontend gérera les défauts)
    return res.json({
      success: true,
      config: config?.value || {},
    });
  } catch (error) {
    logger.error('[SYSTEM-CONTROLLER] Error getting modules config:', error);
    return res.status(500).json({
      error: 'Erreur lors de la récupération de la configuration des modules',
      details: error.message,
      stack: error.stack
    });
  }
};

/**
 * Met à jour la configuration globale des modules.
 * @route POST /api/admin/modules/config
 */
export const updateModulesConfig = async (req, res) => {
  try {
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Configuration invalide' });
    }

    const updatedConfig = await prisma.systemConfig.upsert({
      where: { key: 'global_modules_config' },
      update: {
        value: config,
        updatedAt: new Date(),
      },
      create: {
        key: 'global_modules_config',
        value: config,
      },
    });

    logger.info(`[SYSTEM-CONTROLLER] Modules config updated by user ${req.user.id}`);

    return res.json({
      success: true,
      config: updatedConfig.value,
    });
  } catch (error) {
    logger.error('[SYSTEM-CONTROLLER] Error updating modules config:', error);
    return res.status(500).json({
      error: 'Erreur lors de la mise à jour de la configuration des modules',
    });
  }
};
