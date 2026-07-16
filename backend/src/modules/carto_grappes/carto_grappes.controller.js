import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';
import { socketService } from '../../services/socket.service.js';

function getOrgId(req) {
  return req.user?.organizationId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Carto Regions, Grappes and Lots Management
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère toutes les régions pour une organisation.
 */
export async function getRegions(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const regions = await prisma.cartoRegion.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' }
    });

    res.json(regions);
  } catch (err) {
    logger.error('getRegions error:', err);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
}

/**
 * Crée ou met à jour une région.
 */
export async function upsertRegion(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { id, name, code, description, active } = req.body;

    if (id) {
      const region = await prisma.cartoRegion.update({
        where: { id },
        data: { name, code, description, active: active !== undefined ? active : true }
      });
      res.json(region);
    } else {
      const region = await prisma.cartoRegion.create({
        data: { organizationId, name, code, description, active: true }
      });
      res.json(region);
    }
  } catch (err) {
    logger.error('upsertRegion error:', err);
    res.status(500).json({ error: 'Failed to update region' });
  }
}

/**
 * Récupère toutes les grappes pour une organisation.
 */
export async function getGrappes(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { regionId } = req.query;
    const where = { organizationId, active: true };
    if (regionId) where.regionId = regionId;

    const grappes = await prisma.cartoGrappe.findMany({
      where,
      include: { region: true },
      orderBy: [{ region: { name: 'asc' } }, { grappeNumber: 'asc' }]
    });

    res.json(grappes);
  } catch (err) {
    logger.error('getGrappes error:', err);
    res.status(500).json({ error: 'Failed to fetch grappes' });
  }
}

/**
 * Crée ou met à jour une grappe.
 */
export async function upsertGrappe(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { id, regionId, grappeNumber, grappeKey, menageCount, active } = req.body;

    if (id) {
      const grappe = await prisma.cartoGrappe.update({
        where: { id },
        data: { regionId, grappeNumber, grappeKey, menageCount, active: active !== undefined ? active : true }
      });
      res.json(grappe);
    } else {
      const grappe = await prisma.cartoGrappe.create({
        data: { organizationId, regionId, grappeNumber, grappeKey, menageCount: menageCount || 0, active: true }
      });
      res.json(grappe);
    }
  } catch (err) {
    logger.error('upsertGrappe error:', err);
    res.status(500).json({ error: 'Failed to update grappe' });
  }
}

/**
 * Récupère tous les lots pour une organisation.
 */
export async function getLots(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const lots = await prisma.cartoLot.findMany({
      where: { organizationId, active: true },
      orderBy: { lotKey: 'asc' }
    });

    res.json(lots);
  } catch (err) {
    logger.error('getLots error:', err);
    res.status(500).json({ error: 'Failed to fetch lots' });
  }
}

/**
 * Crée ou met à jour un lot.
 */
export async function upsertLot(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { id, lotKey, title, description, active } = req.body;

    if (id) {
      const lot = await prisma.cartoLot.update({
        where: { id },
        data: { lotKey, title, description, active: active !== undefined ? active : true }
      });
      res.json(lot);
    } else {
      const lot = await prisma.cartoLot.create({
        data: { organizationId, lotKey, title, description, active: true }
      });
      res.json(lot);
    }
  } catch (err) {
    logger.error('upsertLot error:', err);
    res.status(500).json({ error: 'Failed to update lot' });
  }
}

/**
 * Initialise les données par défaut (régions, lots) pour une organisation.
 */
export async function initializeDefaultData(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    // Créer les lots par défaut si n'existent pas
    const defaultLots = [
      { lotKey: 'A', title: 'Lot A - Pré-câblage et Kits de Distribution Intérieure', description: 'Production et installation de kits d\'installation intérieure' },
      { lotKey: 'B', title: 'Lot B - Installation Intérieure', description: 'Génie civil, installation intérieure et kits secondaires' },
      { lotKey: 'C', title: 'Lot C - Branchement', description: 'Tirage câble et branchements' }
    ];

    for (const lot of defaultLots) {
      await prisma.cartoLot.upsert({
        where: { organizationId_lotKey: { organizationId, lotKey: lot.lotKey } },
        update: lot,
        create: { organizationId, ...lot }
      });
    }

    // Récupérer les régions à partir des ménages si disponibles
    const households = await prisma.household.findMany({
      where: { organizationId },
      select: { region: true }
    });

    const uniqueRegions = [...new Set(households.map(h => h.region).filter(Boolean))];

    // Créer les régions détectées
    for (const regionName of uniqueRegions) {
      const code = regionName.toUpperCase().replace(/\s+/g, '_');
      await prisma.cartoRegion.upsert({
        where: { organizationId_code: { organizationId, code } },
        update: { name: regionName, active: true },
        create: { organizationId, name: regionName, code, active: true }
      });
    }

    res.json({ 
      message: 'Default data initialized',
      lots: defaultLots.length,
      regions: uniqueRegions.length
    });
  } catch (err) {
    logger.error('initializeDefaultData error:', err);
    res.status(500).json({ error: 'Failed to initialize default data' });
  }
}

/**
 * Récupère les statistiques du tableau de bord depuis PostgreSQL.
 */
export async function getDashboardStats(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    // Récupérer toutes les régions actives
    const regions = await prisma.cartoRegion.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' }
    });

    // Récupérer toutes les grappes actives
    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      include: { region: true }
    });

    // Récupérer tous les lots actifs
    const lots = await prisma.cartoLot.findMany({
      where: { organizationId, active: true },
      orderBy: { lotKey: 'asc' }
    });

    // Récupérer tous les entrepreneurs
    const entrepreneurs = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId }
    });

    // Calculer les statistiques avec prise en compte de tous les lots
    const stats = {
      totalGrappes: grappes.length,
      totalRegions: regions.length,
      totalLots: lots.length,
      assignedGrappes: 0,
      unassignedGrappes: 0,
      globalAssignments: 0,
      groupAssignments: 0,
      individualAssignments: 0,
      lotStats: {},
      regionStats: {},
      prestataireUsage: {}
    };

    // Pour chaque lot, calculer les assignations
    lots.forEach(lot => {
      const lotEntrepreneurs = entrepreneurs.filter(e => e.lot === lot.lotKey);
      const globalAssignment = lotEntrepreneurs.find(e => e.mode === 'global');
      const groupAssignments = lotEntrepreneurs.filter(e => e.mode === 'groupe');
      const individualAssignments = lotEntrepreneurs.filter(e => e.mode === 'individuel');

      let assigned = 0;
      let global = 0;
      let group = 0;
      let individual = 0;

      if (globalAssignment) {
        global = grappes.length;
        assigned = grappes.length;
      } else {
        group = groupAssignments.reduce((sum, e) => {
          const grappe = grappes.find(g => g.grappeKey === e.grappeKey);
          return sum + (grappe ? 1 : 0);
        }, 0);

        individual = individualAssignments.reduce((sum, e) => {
          const grappe = grappes.find(g => g.grappeKey === e.grappeKey);
          return sum + (grappe ? 1 : 0);
        }, 0);

        assigned = group + individual;
      }

      stats.lotStats[lot.lotKey] = {
        total: grappes.length,
        assigned,
        global,
        group,
        individual
      };

      // Pour les statistiques globales, prendre le maximum assigné parmi tous les lots
      if (assigned > stats.assignedGrappes) {
        stats.assignedGrappes = assigned;
      }
      if (global > stats.globalAssignments) {
        stats.globalAssignments = global;
      }
      if (group > stats.groupAssignments) {
        stats.groupAssignments = group;
      }
      if (individual > stats.individualAssignments) {
        stats.individualAssignments = individual;
      }
    });

    stats.unassignedGrappes = stats.totalGrappes - stats.assignedGrappes;

    // Calculer les statistiques par région en prenant en compte tous les lots
    regions.forEach(region => {
      const regionGrappes = grappes.filter(g => g.regionId === region.id);
      let maxAssignedInRegion = 0;

      // Pour chaque lot, calculer les assignations dans cette région
      lots.forEach(lot => {
        const lotEntrepreneurs = entrepreneurs.filter(e => e.lot === lot.lotKey);
        const globalAssignment = lotEntrepreneurs.find(e => e.mode === 'global');
        const groupAssignments = lotEntrepreneurs.filter(e => e.mode === 'groupe');
        const individualAssignments = lotEntrepreneurs.filter(e => e.mode === 'individuel');

        let assignedInRegion = 0;

        if (globalAssignment) {
          assignedInRegion = regionGrappes.length;
        } else {
          groupAssignments.forEach(e => {
            const grappe = grappes.find(g => g.grappeKey === e.grappeKey);
            if (grappe && grappe.regionId === region.id) {
              assignedInRegion += 1;
            }
          });
          
          assignedInRegion += individualAssignments.filter(e => {
            const grappe = grappes.find(g => g.grappeKey === e.grappeKey);
            return grappe && grappe.regionId === region.id;
          }).length;
        }

        // Garder le maximum d'assignations pour cette région
        if (assignedInRegion > maxAssignedInRegion) {
          maxAssignedInRegion = assignedInRegion;
        }
      });

      stats.regionStats[region.code] = {
        total: regionGrappes.length,
        assigned: maxAssignedInRegion
      };
    });

    // Calculer l'utilisation des prestataires pour tous les lots avec détails complets
    const prestataireMap = {};
    const prestataireDetails = {}; // Pour stocker les détails complets
    
    entrepreneurs.forEach(e => {
      const key = e.entreprise || 'Unknown';
      if (!prestataireMap[key]) {
        prestataireMap[key] = 0;
        prestataireDetails[key] = [];
      }

      if (e.mode === 'global') {
        prestataireMap[key] += grappes.length;
        // Ajouter toutes les grappes avec détails
        grappes.forEach(g => {
          prestataireDetails[key].push({
            lot: e.lot,
            grappeKey: g.grappeKey,
            region: g.region?.name || '',
            menageCount: g.menageCount,
            mode: 'global'
          });
        });
      } else if (e.mode === 'groupe') {
        const grappe = grappes.find(g => g.grappeKey === e.grappeKey);
        if (grappe) {
          prestataireMap[key] += 1;
          prestataireDetails[key].push({
            lot: e.lot,
            grappeKey: grappe.grappeKey,
            region: grappe.region?.name || '',
            menageCount: grappe.menageCount,
            mode: 'groupe'
          });
        }
      } else {
        const grappe = grappes.find(g => g.grappeKey === e.grappeKey);
        if (grappe) {
          prestataireMap[key] += 1;
          prestataireDetails[key].push({
            lot: e.lot,
            grappeKey: grappe.grappeKey,
            region: grappe.region?.name || '',
            menageCount: grappe.menageCount,
            mode: 'individuel'
          });
        }
      }
    });

    stats.prestataireUsage = prestataireMap;
    stats.prestataireDetails = prestataireDetails; // Ajouter les détails complets

    res.json(stats);
  } catch (err) {
    logger.error('getDashboardStats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Household Entries (suivi par ménage/lot)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère toutes les entrées ménages pour une organisation.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getHouseholdEntries(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const entries = await prisma.cartoHouseholdEntry.findMany({
      where: { organizationId },
    });

    const map = {};
    for (const e of entries) {
      map[e.householdOrdre] = {
        A: { status: e.lotAStatus, justif: e.lotAJustif, updatedAt: e.lotAUpdatedAt?.toISOString() || null },
        B: { status: e.lotBStatus, justif: e.lotBJustif, updatedAt: e.lotBUpdatedAt?.toISOString() || null },
        C: { status: e.lotCStatus, justif: e.lotCJustif, updatedAt: e.lotCUpdatedAt?.toISOString() || null },
        conforme: e.conforme,
        obs: e.obs,
      };
    }
    res.json(map);
  } catch (err) {
    logger.error('getHouseholdEntries error:', err);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
}

/**
 * Crée ou met à jour une entrée ménage (statut d'un lot A/B/C et conformité).
 * Crée également une entrée d'historique si le statut d'un lot change.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function upsertHouseholdEntry(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { householdOrdre, lot, status, justif, conforme, obs } = req.body;
    if (!householdOrdre) return res.status(400).json({ error: 'householdOrdre required' });

    const now = new Date();
    const data = {
      organizationId,
      householdOrdre: Number(householdOrdre),
    };

    if (lot && status !== undefined) {
      if (lot === 'A') { data.lotAStatus = status; data.lotAJustif = justif || ''; data.lotAUpdatedAt = now; }
      else if (lot === 'B') { data.lotBStatus = status; data.lotBJustif = justif || ''; data.lotBUpdatedAt = now; }
      else if (lot === 'C') { data.lotCStatus = status; data.lotCJustif = justif || ''; data.lotCUpdatedAt = now; }
    }

    if (conforme !== undefined) data.conforme = conforme;
    if (obs !== undefined) data.obs = obs;

    const entry = await prisma.cartoHouseholdEntry.upsert({
      where: { organizationId_householdOrdre: { organizationId, householdOrdre: Number(householdOrdre) } },
      update: data,
      create: data,
    });

    // Log to history (only when lot status changes)
    if (lot && status !== undefined) {
      await prisma.cartoHistory.create({
        data: {
          organizationId,
          householdOrdre: Number(householdOrdre),
          nom: req.body.nom || '',
          village: req.body.village || '',
          region: req.body.region || '',
          lot,
          fromStatus: req.body.fromStatus || '',
          toStatus: status,
          justif: justif || '',
          userName: req.user?.name || 'system',
        },
      });
    }

    if (organizationId) socketService.emit('carto:updated', { type: 'entries', householdOrdre: Number(householdOrdre) }, 'org_' + organizationId);
    res.json({ ok: true, entry });
  } catch (err) {
    logger.error('upsertHouseholdEntry error:', err);
    res.status(500).json({ error: 'Failed to update entry' });
  }
}

/**
 * Met à jour en masse plusieurs entrées ménages dans une transaction.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function bulkUpsertEntries(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { entries } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

    const now = new Date();
    const operations = entries.map(e => {
      const data = {
        organizationId,
        householdOrdre: Number(e.householdOrdre),
      };
      if (e.lotA) { data.lotAStatus = e.lotA.status; data.lotAJustif = e.lotA.justif || ''; data.lotAUpdatedAt = now; }
      if (e.lotB) { data.lotBStatus = e.lotB.status; data.lotBJustif = e.lotB.justif || ''; data.lotBUpdatedAt = now; }
      if (e.lotC) { data.lotCStatus = e.lotC.status; data.lotCJustif = e.lotC.justif || ''; data.lotCUpdatedAt = now; }
      if (e.conforme !== undefined) data.conforme = e.conforme;
      if (e.obs !== undefined) data.obs = e.obs;

      return prisma.cartoHouseholdEntry.upsert({
        where: { organizationId_householdOrdre: { organizationId, householdOrdre: Number(e.householdOrdre) } },
        update: data,
        create: data,
      });
    });

    await prisma.$transaction(operations);
    if (organizationId) socketService.emit('carto:updated', { type: 'entries', count: entries.length }, 'org_' + organizationId);
    res.json({ ok: true, count: entries.length });
  } catch (err) {
    logger.error('bulkUpsertEntries error:', err);
    res.status(500).json({ error: 'Failed to bulk update entries' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Entrepreneurs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère la liste des entrepreneurs pour une organisation, filtrée par lot optionnel.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getEntrepreneurs(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { lot } = req.query;
    const where = { organizationId };
    if (lot) where.lot = lot;

    const entrepreneurs = await prisma.cartoEntrepreneur.findMany({ where });
    
    // Map __global back to null for frontend compatibility
    const mappedEntrepreneurs = entrepreneurs.map(e => ({
      ...e,
      grappeKey: e.grappeKey === '__global' ? null : e.grappeKey,
    }));
    
    res.json(mappedEntrepreneurs);
  } catch (err) {
    logger.error('getEntrepreneurs error:', err);
    res.status(500).json({ error: 'Failed to fetch entrepreneurs' });
  }
}

/**
 * Crée ou met à jour un entrepreneur (individuel ou lié à une grappe).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function upsertEntrepreneur(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { lot, grappeKey, mode, groupId, entreprise, societe, telephone, email, adresse } = req.body;
    if (!lot) return res.status(400).json({ error: 'lot required' });

    // Use special key for global mode to avoid null issues with unique constraint
    const effectiveGrappeKey = (mode === 'global' || !grappeKey) ? '__global' : grappeKey;

    const data = {
      organizationId,
      lot,
      grappeKey: effectiveGrappeKey,
      mode: mode || 'individuel',
      groupId: groupId || null,
      entreprise: entreprise || '',
      societe: societe || '',
      telephone: telephone || '',
      email: email || '',
      adresse: adresse || '',
    };

    const entrepreneur = await prisma.cartoEntrepreneur.upsert({
      where: { organizationId_lot_grappeKey: { organizationId, lot, grappeKey: effectiveGrappeKey } },
      update: data,
      create: data,
    });

    if (organizationId) socketService.emit('carto:updated', { type: 'entrepreneur', id: entrepreneur?.id, lot }, 'org_' + organizationId);
    res.json(entrepreneur);
  } catch (err) {
    logger.error('upsertEntrepreneur error:', err);
    res.status(500).json({ error: 'Failed to update entrepreneur' });
  }
}

/**
 * Supprime un entrepreneur par son ID.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteEntrepreneur(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { id } = req.params;

    await prisma.cartoEntrepreneur.deleteMany({
      where: { organizationId, id },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'entrepreneur', id, deleted: true }, 'org_' + organizationId);
    res.json({ ok: true });
  } catch (err) {
    logger.error('deleteEntrepreneur error:', err);
    res.status(500).json({ error: 'Failed to delete entrepreneur' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Village Overrides
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère la map des surcharges de numéros de grappes par village.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getVillageOverrides(req, res) {
  try {
    const organizationId = getOrgId(req);
    const overrides = await prisma.cartoVillageOverride.findMany({
      where: { organizationId },
    });
    const map = {};
    for (const o of overrides) map[o.villageKey] = o.grappeNumber;
    res.json(map);
  } catch (err) {
    logger.error('getVillageOverrides error:', err);
    res.status(500).json({ error: 'Failed to fetch overrides' });
  }
}

/**
 * Définit ou met à jour la surcharge du numéro de grappe pour un village.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function setVillageOverride(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { villageKey, grappeNumber } = req.body;

    const override = await prisma.cartoVillageOverride.upsert({
      where: { organizationId_villageKey: { organizationId, villageKey } },
      update: { grappeNumber },
      create: { organizationId, villageKey, grappeNumber },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'villageOverride', villageKey, grappeNumber }, 'org_' + organizationId);
    res.json(override);
  } catch (err) {
    logger.error('setVillageOverride error:', err);
    res.status(500).json({ error: 'Failed to set override' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// History
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère l'historique des changements de statuts.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getHistory(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { limit = 500 } = req.query;

    const history = await prisma.cartoHistory.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
    res.json(history);
  } catch (err) {
    logger.error('getHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}

/**
 * Vide tout l'historique des changements pour l'organisation courante.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function clearHistory(req, res) {
  try {
    const organizationId = getOrgId(req);
    await prisma.cartoHistory.deleteMany({ where: { organizationId } });
    if (organizationId) socketService.emit('carto:updated', { type: 'history', cleared: true }, 'org_' + organizationId);
    res.json({ ok: true });
  } catch (err) {
    logger.error('clearHistory error:', err);
    res.status(500).json({ error: 'Failed to clear history' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Settings
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les paramètres carto pour l'organisation (crée des paramètres par défaut si absents).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getSettings(req, res) {
  try {
    const organizationId = getOrgId(req);
    let settings = await prisma.cartoSettings.findUnique({ where: { organizationId } });
    if (!settings) {
      settings = await prisma.cartoSettings.create({ data: { organizationId } });
    }
    res.json(settings);
  } catch (err) {
    logger.error('getSettings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

/**
 * Met à jour les paramètres carto pour l'organisation.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function updateSettings(req, res) {
  try {
    const organizationId = getOrgId(req);
    const data = req.body;

    const settings = await prisma.cartoSettings.upsert({
      where: { organizationId },
      update: data,
      create: { organizationId, ...data },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'settings' }, 'org_' + organizationId);
    res.json(settings);
  } catch (err) {
    logger.error('updateSettings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Workflow (approbation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère la file d'attente des workflows (soumissions en attente d'approbation).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getWorkflowQueue(req, res) {
  try {
    const organizationId = getOrgId(req);
    const queue = await prisma.cartoWorkflow.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(queue);
  } catch (err) {
    logger.error('getWorkflowQueue error:', err);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
}

/**
 * Soumet un nouveau workflow d'approbation.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function submitWorkflow(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { householdOrdre, nom, village, region, grappe, statuts } = req.body;

    const entry = await prisma.cartoWorkflow.create({
      data: {
        organizationId,
        householdOrdre,
        nom, village, region, grappe,
        submittedBy: req.user?.name || 'system',
        statuts: statuts || {},
      },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'workflow', submitted: true, householdOrdre }, 'org_' + organizationId);
    res.json(entry);
  } catch (err) {
    logger.error('submitWorkflow error:', err);
    res.status(500).json({ error: 'Failed to submit workflow' });
  }
}

/**
 * Approuve un workflow par son ID.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function approveWorkflow(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { id } = req.params;
    const entry = await prisma.cartoWorkflow.update({
      where: { id },
      data: { status: 'approved', updatedAt: new Date() },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'workflow', approved: true, id }, 'org_' + organizationId);
    res.json(entry);
  } catch (err) {
    logger.error('approveWorkflow error:', err);
    res.status(500).json({ error: 'Failed to approve workflow' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Archive
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère la liste des archives (snapshots de grappes).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getArchives(req, res) {
  try {
    const organizationId = getOrgId(req);
    const archives = await prisma.cartoArchive.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(archives);
  } catch (err) {
    logger.error('getArchives error:', err);
    res.status(500).json({ error: 'Failed to fetch archives' });
  }
}

/**
 * Crée une nouvelle archive (snapshot d'une grappe à un instant T).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function createArchive(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { grappeKey, region, grappe, totalMenages, totalConformes, snapshot } = req.body;

    const archive = await prisma.cartoArchive.create({
      data: {
        organizationId,
        grappeKey,
        archivedBy: req.user?.name || 'system',
        region, grappe, totalMenages, totalConformes,
        snapshot: snapshot || [],
      },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'archive', grappeKey }, 'org_' + organizationId);
    res.json(archive);
  } catch (err) {
    logger.error('createArchive error:', err);
    res.status(500).json({ error: 'Failed to create archive' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stats Snapshots
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les 90 derniers snapshots de statistiques.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getStatsSnapshots(req, res) {
  try {
    const organizationId = getOrgId(req);
    const snapshots = await prisma.cartoStatsSnapshot.findMany({
      where: { organizationId },
      orderBy: { snapshotDate: 'desc' },
      take: 90,
    });
    res.json(snapshots);
  } catch (err) {
    logger.error('getStatsSnapshots error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

/**
 * Crée ou met à jour un snapshot de statistiques pour la date courante.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function createStatsSnapshot(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { conforme, lotA, lotB, lotC, bloques } = req.body;
    const snapshotDate = new Date().toISOString().split('T')[0];

    const snapshot = await prisma.cartoStatsSnapshot.upsert({
      where: { organizationId_snapshotDate: { organizationId, snapshotDate } },
      update: { conforme, lotA, lotB, lotC, bloques },
      create: { organizationId, snapshotDate, conforme, lotA, lotB, lotC, bloques },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'statsSnapshot', snapshotDate }, 'org_' + organizationId);
    res.json(snapshot);
  } catch (err) {
    logger.error('createStatsSnapshot error:', err);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Planning Params
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les paramètres de planning pour l'organisation.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getPlanningParams(req, res) {
  try {
    const organizationId = getOrgId(req);
    const params = await prisma.cartoPlanningParams.findUnique({ where: { organizationId } });
    res.json(params?.params || {});
  } catch (err) {
    logger.error('getPlanningParams error:', err);
    res.status(500).json({ error: 'Failed to fetch planning params' });
  }
}

/**
 * Met à jour les paramètres de planning pour l'organisation.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function updatePlanningParams(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { params } = req.body;

    await prisma.cartoPlanningParams.upsert({
      where: { organizationId },
      update: { params },
      create: { organizationId, params },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'planningParams' }, 'org_' + organizationId);
    res.json({ ok: true });
  } catch (err) {
    logger.error('updatePlanningParams error:', err);
    res.status(500).json({ error: 'Failed to update planning params' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Gantt
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère toutes les entrées du diagramme de Gantt.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getGantt(req, res) {
  try {
    const organizationId = getOrgId(req);
    const entries = await prisma.cartoGantt.findMany({ where: { organizationId } });
    res.json(entries);
  } catch (err) {
    logger.error('getGantt error:', err);
    res.status(500).json({ error: 'Failed to fetch gantt' });
  }
}

/**
 * Crée ou met à jour une entrée du diagramme de Gantt.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function upsertGantt(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { grappeKey, phase, startDate, endDate, status, data } = req.body;

    const entry = await prisma.cartoGantt.upsert({
      where: { organizationId_grappeKey_phase: { organizationId, grappeKey, phase } },
      update: { startDate, endDate, status, data },
      create: { organizationId, grappeKey, phase, startDate, endDate, status, data },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'gantt', grappeKey, phase }, 'org_' + organizationId);
    res.json(entry);
  } catch (err) {
    logger.error('upsertGantt error:', err);
    res.status(500).json({ error: 'Failed to update gantt' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fiches de suivi
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les fiches de suivi, optionnellement filtrées par ficheKey.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getFiches(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { ficheKey } = req.query;
    const where = { organizationId };
    if (ficheKey) where.ficheKey = ficheKey;

    const fiches = await prisma.cartoFiche.findMany({ where, orderBy: { entryIndex: 'asc' } });
    res.json(fiches);
  } catch (err) {
    logger.error('getFiches error:', err);
    res.status(500).json({ error: 'Failed to fetch fiches' });
  }
}

/**
 * Ajoute une entrée dans une fiche de suivi.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function addFicheEntry(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { ficheKey, data } = req.body;

    const count = await prisma.cartoFiche.count({ where: { organizationId, ficheKey } });

    const entry = await prisma.cartoFiche.create({
      data: {
        organizationId,
        ficheKey,
        entryIndex: count,
        data: data || {},
        author: req.user?.name || 'system',
      },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'fiche', ficheKey, entryIndex: count }, 'org_' + organizationId);
    res.json(entry);
  } catch (err) {
    logger.error('addFicheEntry error:', err);
    res.status(500).json({ error: 'Failed to add fiche entry' });
  }
}

/**
 * Supprime une entrée de fiche de suivi.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteFicheEntry(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { id } = req.params;

    const entry = await prisma.cartoFiche.findUnique({ where: { id } });
    if (!entry || entry.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    await prisma.cartoFiche.delete({ where: { id } });
    if (organizationId) socketService.emit('carto:updated', { type: 'fiche', ficheKey: entry.ficheKey }, 'org_' + organizationId);
    res.json({ ok: true });
  } catch (err) {
    logger.error('deleteFicheEntry error:', err);
    res.status(500).json({ error: 'Failed to delete fiche entry' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Photos
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère une photo par ménage et lot.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getPhoto(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { householdOrdre, lot } = req.query;

    const photo = await prisma.cartoPhoto.findUnique({
      where: { organizationId_householdOrdre_lot: { organizationId, householdOrdre: Number(householdOrdre), lot } },
    });
    res.json(photo || null);
  } catch (err) {
    res.json(null);
  }
}

/**
 * Sauvegarde ou met à jour une photo pour un ménage/lot.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function savePhoto(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { householdOrdre, lot, data } = req.body;

    const photo = await prisma.cartoPhoto.upsert({
      where: { organizationId_householdOrdre_lot: { organizationId, householdOrdre: Number(householdOrdre), lot } },
      update: { data, userName: req.user?.name || 'system' },
      create: { organizationId, householdOrdre: Number(householdOrdre), lot, data, userName: req.user?.name || 'system' },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'photo', householdOrdre: Number(householdOrdre), lot }, 'org_' + organizationId);
    res.json(photo);
  } catch (err) {
    logger.error('savePhoto error:', err);
    res.status(500).json({ error: 'Failed to save photo' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Contract Templates
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère les templates de contrats (map lot → HTML).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getContractTemplates(req, res) {
  try {
    const organizationId = getOrgId(req);
    const templates = await prisma.cartoContractTemplate.findMany({ where: { organizationId } });
    const map = {};
    for (const t of templates) map[t.lot] = t.htmlContent;
    res.json(map);
  } catch (err) {
    logger.error('getContractTemplates error:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

/**
 * Sauvegarde ou met à jour un template de contrat pour un lot.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function saveContractTemplate(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { lot, htmlContent } = req.body;

    const template = await prisma.cartoContractTemplate.upsert({
      where: { organizationId_lot: { organizationId, lot } },
      update: { htmlContent },
      create: { organizationId, lot, htmlContent },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'contractTemplate', lot }, 'org_' + organizationId);
    res.json(template);
  } catch (err) {
    logger.error('saveContractTemplate error:', err);
    res.status(500).json({ error: 'Failed to save template' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Reference Data (Villages, Menages, GPS, Prestataires)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère tous les villages (reference data).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getVillages(req, res) {
  try {
    const villages = await prisma.$queryRaw`
      SELECT region, village, n, lat, lon, defaultgrappe, x, y
      FROM carto_villages
      ORDER BY region, village
    `;
    res.json(villages);
  } catch (err) {
    logger.error('getVillages error:', err);
    res.status(500).json({ error: 'Failed to fetch villages' });
  }
}

/**
 * Récupère tous les ménages (reference data).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getMenages(req, res) {
  try {
    const menages = await prisma.$queryRaw`
      SELECT ordre, nom, tel, village, commune, region
      FROM carto_menages
      ORDER BY ordre
    `;
    res.json(menages);
  } catch (err) {
    logger.error('getMenages error:', err);
    res.status(500).json({ error: 'Failed to fetch menages' });
  }
}

/**
 * Récupère toutes les données GPS (reference data).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getGps(req, res) {
  try {
    const gps = await prisma.$queryRaw`
      SELECT ordre, lat, lon, accuracy
      FROM carto_gps
      ORDER BY ordre
    `;
    res.json(gps);
  } catch (err) {
    logger.error('getGps error:', err);
    res.status(500).json({ error: 'Failed to fetch GPS data' });
  }
}

/**
 * Récupère tous les prestataires (reference data).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getPrestataires(req, res) {
  try {
      const prestataires = await prisma.$queryRaw`
        SELECT id, nom, entreprise, societe, telephone, email, adresse, lot, region
        FROM carto_prestataires
        ORDER BY nom
      `;
    res.json(prestataires);
  } catch (err) {
    logger.error('getPrestataires error:', err);
    res.status(500).json({ error: 'Failed to fetch prestataires' });
  }
}

/**
 * Upsert multiple prestataires (import Excel/JSON).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function upsertPrestataires(req, res) {
  try {
    const { prestataires } = req.body;
    if (!Array.isArray(prestataires)) {
      return res.status(400).json({ error: 'prestataires must be an array' });
    }

    let added = 0;
    let updated = 0;

    for (const p of prestataires) {
      if (!p.nom && !p.entreprise) continue;
      const nom = p.nom || p.entreprise || '';
      const result = await prisma.$executeRaw`
        INSERT INTO carto_prestataires (nom, entreprise, societe, telephone, email, adresse, lot, region)
        VALUES (${nom}, ${p.entreprise || nom || null}, ${p.societe || null}, ${p.telephone || null}, ${p.email || null}, ${p.adresse || null}, ${p.lot || null}, ${p.region || null})
        ON CONFLICT (nom) DO UPDATE SET
          entreprise = EXCLUDED.entreprise,
          societe = EXCLUDED.societe,
          telephone = EXCLUDED.telephone,
          email = EXCLUDED.email,
          adresse = EXCLUDED.adresse,
          lot = EXCLUDED.lot,
          region = EXCLUDED.region
      `;
      if (result > 0) added++;
    }

    res.json({ added, updated, total: prestataires.length });
  } catch (err) {
    logger.error('upsertPrestataires error:', err);
    res.status(500).json({ error: 'Failed to upsert prestataires' });
  }
}

/**
 * Update a single prestataire by id.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function updatePrestataire(req, res) {
  try {
    const { id } = req.params;
    const { nom, entreprise, societe, telephone, email, adresse, lot, region } = req.body;
    
    const result = await prisma.$executeRaw`
      UPDATE carto_prestataires
      SET nom = ${nom || ''},
          entreprise = ${entreprise || ''},
          societe = ${societe || null},
          telephone = ${telephone || null},
          email = ${email || null},
          adresse = ${adresse || null},
          lot = ${lot || null},
          region = ${region || null}
      WHERE id = ${Number(id)}
      RETURNING *
    `;
    
    res.json({ ok: true, prestataire: result[0] });
  } catch (err) {
    logger.error('updatePrestataire error:', err);
    res.status(500).json({ error: 'Failed to update prestataire' });
  }
}

/**
 * Delete a prestataire by id.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deletePrestataire(req, res) {
  try {
    const { id } = req.params;
    await prisma.$executeRaw`DELETE FROM carto_prestataires WHERE id = ${Number(id)}`;
    res.json({ ok: true });
  } catch (err) {
    logger.error('deletePrestataire error:', err);
    res.status(500).json({ error: 'Failed to delete prestataire' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Alerts Config
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère la configuration des alertes (crée une config par défaut si absente).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getAlertsConfig(req, res) {
  try {
    const organizationId = getOrgId(req);
    let config = await prisma.cartoAlerts.findUnique({ where: { organizationId } });
    if (!config) {
      config = await prisma.cartoAlerts.create({ data: { organizationId } });
    }
    res.json(config);
  } catch (err) {
    logger.error('getAlertsConfig error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts config' });
  }
}

/**
 * Met à jour la configuration des alertes (delayDays, enabled, dismissed).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function updateAlertsConfig(req, res) {
  try {
    const organizationId = getOrgId(req);
    const { delayDays, enabled, dismissed } = req.body;

    const config = await prisma.cartoAlerts.upsert({
      where: { organizationId },
      update: { delayDays, enabled, dismissed },
      create: { organizationId, delayDays, enabled, dismissed },
    });
    if (organizationId) socketService.emit('carto:updated', { type: 'alertsConfig' }, 'org_' + organizationId);
    res.json(config);
  } catch (err) {
    logger.error('updateAlertsConfig error:', err);
    res.status(500).json({ error: 'Failed to update alerts config' });
  }
}
