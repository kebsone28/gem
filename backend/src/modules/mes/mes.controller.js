import { mesService } from './mes.service.js';

/**
 * Récupérer tous les enregistrements MES
 */
export async function getMESRecords(req, res) {
  try {
    const { prestataire, status, month, search, zone, poste } = req.query;
    const filters = {
      prestataire,
      status,
      month,
      searchQuery: search,
      zone,
      poste,
    };
    
    const records = await mesService.getMESRecords(filters, req.organization.id);
    res.json({ records });
  } catch (error) {
    console.error('[MESController] Error fetching MES records:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des enregistrements MES' });
  }
}

/**
 * Récupérer un enregistrement MES par ID
 */
export async function getMESRecordById(req, res) {
  try {
    const { id } = req.params;
    const record = await mesService.getMESRecordById(id, req.organization.id);
    
    if (!record) {
      return res.status(404).json({ error: 'Enregistrement MES non trouvé' });
    }
    
    res.json(record);
  } catch (error) {
    console.error('[MESController] Error fetching MES record:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'enregistrement MES' });
  }
}

/**
 * Créer un nouvel enregistrement MES
 */
export async function createMESRecord(req, res) {
  try {
    const record = await mesService.createMESRecord(req.body, req.organization.id, req.user.id);
    res.status(201).json(record);
  } catch (error) {
    console.error('[MESController] Error creating MES record:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'enregistrement MES' });
  }
}

/**
 * Mettre à jour un enregistrement MES
 */
export async function updateMESRecord(req, res) {
  try {
    const { id } = req.params;
    const record = await mesService.updateMESRecord(id, req.body, req.organization.id, req.user.id);
    
    if (!record) {
      return res.status(404).json({ error: 'Enregistrement MES non trouvé' });
    }
    
    res.json(record);
  } catch (error) {
    console.error('[MESController] Error updating MES record:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'enregistrement MES' });
  }
}

/**
 * Supprimer un enregistrement MES
 */
export async function deleteMESRecord(req, res) {
  try {
    const { id } = req.params;
    await mesService.deleteMESRecord(id, req.organization.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[MESController] Error deleting MES record:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'enregistrement MES' });
  }
}

/**
 * Mettre à jour le statut d'un enregistrement MES
 */
export async function updateMESStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const record = await mesService.updateMESStatus(id, status, req.organization.id, req.user.id);
    
    if (!record) {
      return res.status(404).json({ error: 'Enregistrement MES non trouvé' });
    }
    
    res.json(record);
  } catch (error) {
    console.error('[MESController] Error updating MES status:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut MES' });
  }
}

/**
 * Valider un enregistrement MES
 */
export async function validateMESRecord(req, res) {
  try {
    const { id } = req.params;
    const { validatorId } = req.body;
    const record = await mesService.validateMESRecord(id, validatorId || req.user.id, req.organization.id);
    
    if (!record) {
      return res.status(404).json({ error: 'Enregistrement MES non trouvé' });
    }
    
    res.json(record);
  } catch (error) {
    console.error('[MESController] Error validating MES record:', error);
    res.status(500).json({ error: 'Erreur lors de la validation de l\'enregistrement MES' });
  }
}

/**
 * Contrôler un enregistrement MES
 */
export async function controlMESRecord(req, res) {
  try {
    const { id } = req.params;
    const { controllerId, checklist } = req.body;
    const record = await mesService.controlMESRecord(
      id,
      controllerId || req.user.id,
      checklist,
      req.organization.id
    );
    
    if (!record) {
      return res.status(404).json({ error: 'Enregistrement MES non trouvé' });
    }
    
    res.json(record);
  } catch (error) {
    console.error('[MESController] Error controlling MES record:', error);
    res.status(500).json({ error: 'Erreur lors du contrôle de l\'enregistrement MES' });
  }
}

/**
 * Récupérer les statistiques MES
 */
export async function getMESStats(req, res) {
  try {
    const { month, prestataire } = req.query;
    const filters = { month, prestataire };
    const stats = await mesService.getMESStats(filters, req.organization.id);
    res.json(stats);
  } catch (error) {
    console.error('[MESController] Error fetching MES stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques MES' });
  }
}

/**
 * Importer des données depuis Excel
 */
export async function importFromExcel(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier Excel requis' });
    }
    
    const result = await mesService.importFromExcel(req.file, req.organization.id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('[MESController] Error importing from Excel:', error);
    res.status(500).json({ error: 'Erreur lors de l\'import Excel' });
  }
}

/**
 * Exporter des données vers Excel
 */
export async function exportToExcel(req, res) {
  try {
    const { prestataire, status, month } = req.query;
    const filters = { prestataire, status, month };
    const buffer = await mesService.exportToExcel(filters, req.organization.id);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=mes_export.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('[MESController] Error exporting to Excel:', error);
    res.status(500).json({ error: 'Erreur lors de l\'export Excel' });
  }
}

/**
 * Récupérer les zones disponibles
 */
export async function getZones(req, res) {
  try {
    const zones = await mesService.getZones(req.organization.id);
    res.json({ zones });
  } catch (error) {
    console.error('[MESController] Error fetching zones:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des zones' });
  }
}

/**
 * Récupérer les postes disponibles
 */
export async function getPostes(req, res) {
  try {
    const postes = await mesService.getPostes(req.organization.id);
    res.json({ postes });
  } catch (error) {
    console.error('[MESController] Error fetching postes:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des postes' });
  }
}

/**
 * Récupérer les agents disponibles
 */
export async function getAgents(req, res) {
  try {
    const { prestataire } = req.query;
    const agents = await mesService.getAgents(req.organization.id, prestataire);
    res.json({ agents });
  } catch (error) {
    console.error('[MESController] Error fetching agents:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des agents' });
  }
}
