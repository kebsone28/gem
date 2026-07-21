import { Prisma } from '@prisma/client';
import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';
import { socketService } from '../../services/socket.service.js';

function getOrgId(req) {
  return req.user?.organizationId;
}

// ══════════════════════════════════════════════════════════════════════════════
// Carto Regions, Grappes and Lots Management
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Récupère toutes les régions pour une organisation.
 */
export async function getRegions(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const regions = await prisma.cartoRegion.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' },
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
        data: { name, code, description, active: active !== undefined ? active : true },
      });
      res.json(region);
    } else {
      const region = await prisma.cartoRegion.create({
        data: { organizationId, name, code, description, active: true },
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
      orderBy: [{ region: { name: 'asc' } }, { grappeNumber: 'asc' }],
    });

    const mapped = grappes.map((g) => ({
      region: g.region?.name || 'Unknown',
      key: g.grappeKey,
      label: `Grappe ${g.grappeNumber}`,
      households: g.menageCount,
      villages: 0,
    }));

    res.json({ grappes: mapped });
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
        data: {
          regionId,
          grappeNumber,
          grappeKey,
          menageCount,
          active: active !== undefined ? active : true,
        },
      });
      res.json(grappe);
    } else {
      const grappe = await prisma.cartoGrappe.create({
        data: { organizationId, regionId, grappeNumber, grappeKey, menageCount, active: true },
      });
      res.json(grappe);
    }
  } catch (err) {
    logger.error('upsertGrappe error:', err);
    res.status(500).json({ error: 'Failed to update grappe' });
  }
}

/**
 * Récupère toutes les lots pour une organisation.
 */
export async function getLots(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const lots = await prisma.cartoLot.findMany({
      where: { organizationId, active: true },
      orderBy: { lotKey: 'asc' },
    });

    // Count grappes per lot
    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
    });
    const grappesCountByLot = {};
    for (const g of grappes) {
      for (const lotKey of ['A', 'B', 'C']) {
        if (g.grappeKey?.includes(lotKey)) {
          grappesCountByLot[lotKey] = (grappesCountByLot[lotKey] || 0) + 1;
        }
      }
    }

    const mapped = lots.map((l) => ({
      key: l.lotKey,
      title: l.title,
      description: l.description || '',
      active: l.active,
      grappesCount: grappesCountByLot[l.lotKey] || 0,
    }));

    res.json({ lots: mapped });
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
        data: { lotKey, title, description, active: active !== undefined ? active : true },
      });
      res.json(lot);
    } else {
      const lot = await prisma.cartoLot.create({
        data: { organizationId, lotKey, title, description, active: true },
      });
      res.json(lot);
    }
  } catch (err) {
    logger.error('upsertLot error:', err);
    res.status(500).json({ error: 'Failed to update lot' });
  }
}

/**
 * Initialise les données par défaut pour une organisation.
 */
export async function initializeDefaultData(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    // Default lots
    const defaultLots = [
      {
        lotKey: 'A',
        title: 'Lot A — Pré-câblage',
        description: 'Pré-câblage & coffrets',
        active: true,
      },
      {
        lotKey: 'B',
        title: 'Lot B — Installation intérieure',
        description: 'Installation intérieure',
        active: true,
      },
      {
        lotKey: 'C',
        title: 'Lot C — Raccordement',
        description: 'Raccordement abonnés',
        active: true,
      },
    ];

    // Default regions
    const defaultRegions = [
      { name: 'Kaffrine', code: 'KAF', organizationId, active: true },
      { name: 'Tambacounda', code: 'TAM', organizationId, active: true },
    ];

    // Default grappes
    const defaultGrappes = [
      { regionId: '00000000-0000-0000-0000-000000000001', grappeNumber: 1, grappeKey: 'KAF_G001', menageCount: 9, active: true },
      { regionId: '00000000-0000-0000-0000-000000000001', grappeNumber: 2, grappeKey: 'KAF_G002', menageCount: 14, active: true },
      { regionId: '00000000-0000-0000-0000-000000000001', grappeNumber: 3, grappeKey: 'KAF_G003', menageCount: 5, active: true },
      { regionId: '00000000-0000-0000-0000-000000000001', grappeNumber: 4, grappeKey: 'KAF_G004', menageCount: 17, active: true },
      { regionId: '00000000-0000-0000-0000-000000000001', grappeNumber: 5, grappeKey: 'KAF_G005', menageCount: 4, active: true },
      { regionId: '00000000-0000-0000-0000-000000000002', grappeNumber: 1, grappeKey: 'TAM_G001', menageCount: 8, active: true },
      { regionId: '00000000-0000-0000-0000-000000000002', grappeNumber: 2, grappeKey: 'TAM_G002', menageCount: 7, active: true },
      { regionId: '00000000-0000-0000-0000-000000000002', grappeNumber: 3, grappeKey: 'TAM_G003', menageCount: 11, active: true },
    ];

    // Default entrepreneurs (empty for now)
    const defaultEntrepreneurs = [];

    // Default settings
    const defaultSettings = {
      organizationId,
      bareme: {},
      lotLabels: {},
      featureToggles: {},
    };

    // Upsert regions
    const regionPromises = defaultRegions.map((r) =>
      prisma.cartoRegion.upsert({
        where: { organizationId_code: { organizationId, code: r.code } },
        create: r,
        update: r,
      })
    );

    // Upsert lots
    const lotPromises = defaultLots.map((l) =>
      prisma.cartoLot.upsert({
        where: { organizationId_lotKey: { organizationId, lotKey: l.lotKey } },
        create: { ...l, organizationId },
        update: l,
      })
    );

    // Upsert grappes
    const grappePromises = defaultGrappes.map((g) =>
      prisma.cartoGrappe.upsert({
        where: { organizationId_grappeKey: { organizationId, grappeKey: g.grappeKey } },
        create: { ...g, organizationId },
        update: g,
      })
    );

    // Upsert entrepreneurs
    const entrepreneurPromises = defaultEntrepreneurs.map((e) =>
      prisma.cartoEntrepreneur.upsert({
        where: {
          organizationId_lot_grappeKey_entreprise: {
            organizationId,
            lot: e.lot,
            grappeKey: e.grappeKey,
            entreprise: e.entreprise || '',
          },
        },
        create: { ...e, organizationId },
        update: e,
      })
    );

    // Upsert settings
    await prisma.cartoSettings.upsert({
      where: { organizationId },
      create: defaultSettings,
      update: defaultSettings,
    });

    await Promise.all([
      ...regionPromises,
      ...lotPromises,
      ...grappePromises,
      ...entrepreneurPromises,
    ]);

    // Count unique regions from households
    const householdRegions = await prisma.household.findMany({
      where: { organizationId },
      select: { region: true },
    });
    const distinctRegions = [...new Set(householdRegions.map((h) => h.region))];

    res.json({ success: true, message: 'Default data initialized', lots: defaultLots.length, regions: distinctRegions.length });
  } catch (err) {
    logger.error('initializeDefaultData error:', err);
    res.status(500).json({ error: 'Failed to initialize default data' });
  }
}

/**
 * Récupère les statistiques du tableau de bord.
 */
export async function getDashboardStats(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const regions = await prisma.cartoRegion.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' },
    });

    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      orderBy: [{ region: { name: 'asc' } }, { grappeNumber: 'asc' }],
    });

    const lots = await prisma.cartoLot.findMany({
      where: { organizationId, active: true },
      orderBy: { lotKey: 'asc' },
    });

    const entrepreneurs = await prisma.cartoEntrepreneur.findMany({
      where: { organizationId },
    });

    // Compute stats
    const totalGrappes = grappes.length;
    const totalRegions = regions.length;
    const totalLots = lots.length;
    const assignedGrappes = grappes.filter((g) => g.menageCount > 0).length;
    const unassignedGrappes = grappes.filter((g) => g.menageCount === 0).length;
    const globalAssignments = grappes.filter((g) => g.menageCount > 0 && g.active).length;
    const groupAssignments = grappes.filter(
      (g) => g.menageCount > 0 && g.active && g.grappeNumber > 0
    ).length;
    const individualAssignments = grappes.filter(
      (g) => g.menageCount > 0 && g.active && g.grappeNumber === 0
    ).length;

    // Lot stats
    const lotStats = {};
    for (const lot of lots) {
      const key = lot.lotKey;
      const grappesInLot = grappes.filter((g) => g.grappeKey?.includes(key) && g.active);
      lotStats[key] = {
        total: grappesInLot.length,
        assigned: grappesInLot.filter((g) => g.menageCount > 0).length,
      };
    }

    // Region stats
    const regionStats = {};
    for (const region of regions) {
      const grappesInRegion = grappes.filter((g) => g.regionId === region.id && g.active);
      regionStats[region.name] = {
        total: grappesInRegion.length,
        assigned: grappesInRegion.filter((g) => g.menageCount > 0).length,
      };
    }

    // Prestataire usage
    const prestataireUsage = {};
    for (const prestataire of entrepreneurs) {
      const key = `${prestataire.lot}_${prestataire.grappeKey || 'none'}`;
      prestataireUsage[key] = (prestataireUsage[key] || 0) + 1;
    }

    const stats = {
      totalGrappes,
      totalRegions,
      totalLots,
      assignedGrappes,
      unassignedGrappes,
      globalAssignments,
      groupAssignments,
      individualAssignments,
      lotStats,
      regionStats,
      prestataireUsage,
    };

    res.json(stats);
  } catch (err) {
    logger.error('getDashboardStats error:', err);
    res.status(500).json({ error: 'Failed to compute dashboard stats' });
  }
}

/**
 * Récupère toutes les entrées de ménage.
 */
export async function getHouseholdEntries(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const entries = await prisma.cartoHouseholdEntry.findMany({
      where: { organizationId },
      orderBy: { householdOrdre: 'asc' },
    });

    const result = {};
    for (const e of entries) {
      result[e.householdOrdre] = {
        A: { status: e.lotAStatus, justif: e.lotAJustif, updatedAt: e.lotAUpdatedAt },
        B: { status: e.lotBStatus, justif: e.lotBJustif, updatedAt: e.lotBUpdatedAt },
        C: { status: e.lotCStatus, justif: e.lotCJustif, updatedAt: e.lotCUpdatedAt },
        conforme: e.conforme,
        obs: e.obs,
      };
    }

    res.json(result);
  } catch (err) {
    logger.error('getHouseholdEntries error:', err);
    res.status(500).json({ error: 'Failed to fetch household entries' });
  }
}

/**
 * Sauvegarde une entrée de ménage.
 */
export async function upsertHouseholdEntry(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { householdOrdre, lot, status, justif, conforme, obs } = req.body;
    if (!householdOrdre || !lot) {
      return res.status(400).json({ error: 'householdOrdre and lot required' });
    }

    const ordre = parseInt(householdOrdre, 10);
    const lotStatusField = `lot${lot}Status`;
    const lotJustifField = `lot${lot}Justif`;
    const lotUpdatedAtField = `lot${lot}UpdatedAt`;
    const now = new Date();

    await prisma.cartoHouseholdEntry.upsert({
      where: {
        organizationId_householdOrdre: { organizationId, householdOrdre: ordre },
      },
      create: {
        organizationId,
        householdOrdre: ordre,
        [lotStatusField]: status,
        [lotJustifField]: justif || '',
        [lotUpdatedAtField]: now,
        conforme: conforme || false,
        obs: obs || '',
      },
      update: {
        [lotStatusField]: status,
        [lotJustifField]: justif || '',
        [lotUpdatedAtField]: now,
      },
    });

    await prisma.cartoHistory.create({
      data: {
        organizationId,
        householdOrdre: ordre,
        nom: '',
        village: '',
        region: '',
        lot,
        fromStatus: '',
        toStatus: status,
        justif: justif || '',
        userName: req.user?.name || '',
      },
    });

    socketService.emit('carto:updated', { type: 'entries', householdOrdre: ordre }, `org_${organizationId}`);

    res.json({ ok: true });
  } catch (err) {
    logger.error('upsertHouseholdEntry error:', err);
    res.status(500).json({ error: 'Failed to update household entry' });
  }
}

/**
 * Bulk upsert household entries.
 */
export async function bulkUpsertEntries(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const entries = req.body.entries;
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'entries array required' });
    }

    const now = new Date();
    const operations = entries.map((entry) => {
      const { householdOrdre, lotA, lotB, lotC, conforme, obs } = entry;
      const ordre = parseInt(householdOrdre, 10);

      let lotLetter, status, justif;
      if (lotA) { lotLetter = 'A'; status = lotA.status; justif = lotA.justif; }
      else if (lotB) { lotLetter = 'B'; status = lotB.status; justif = lotB.justif; }
      else if (lotC) { lotLetter = 'C'; status = lotC.status; justif = lotC.justif; }

      const lotStatusField = `lot${lotLetter}Status`;
      const lotJustifField = `lot${lotLetter}Justif`;
      const lotUpdatedAtField = `lot${lotLetter}UpdatedAt`;

      return prisma.cartoHouseholdEntry.upsert({
        where: {
          organizationId_householdOrdre: { organizationId, householdOrdre: ordre },
        },
        create: {
          organizationId,
          householdOrdre: ordre,
          [lotStatusField]: status,
          [lotJustifField]: justif || '',
          [lotUpdatedAtField]: now,
          conforme: conforme || false,
          obs: obs || '',
        },
        update: {
          [lotStatusField]: status,
          [lotJustifField]: justif || '',
          [lotUpdatedAtField]: now,
        },
      });
    });

    const results = await Promise.all(operations);
    socketService.emit('carto:updated', { type: 'entries', count: results.length }, `org_${organizationId}`);
    res.json({ count: results.length, ok: true });
  } catch (err) {
    logger.error('bulkUpsertEntries error:', err);
    res.status(500).json({ error: 'Failed to bulk upsert entries' });
  }
}

/**
 * Récupère les entrepreneurs.
 */
export async function getEntrepreneurs(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const lot = req.query.lot;
    const where = lot ? { organizationId, lot } : { organizationId };
    const entrepreneurs = await prisma.cartoEntrepreneur.findMany({
      where,
    });

    // Build a map of grappeKey -> region name for region lookup
    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId },
      include: { region: true },
    });
    const grappeRegionMap = {};
    for (const g of grappes) {
      grappeRegionMap[g.grappeKey] = g.region?.name || '';
    }

    // Transform to assignments format for frontend
    const assignments = entrepreneurs
      .filter((e) => e.lot)
      .map((e) => ({
        grappeKey: e.grappeKey || '',
        region: grappeRegionMap[e.grappeKey] || '',
        lotKey: e.lot,
        mode: e.mode || 'groupe',
        prestataire: e.entreprise || '',
      }));

    res.json({ assignments });
  } catch (err) {
    logger.error('getEntrepreneurs error:', err);
    res.status(500).json({ error: 'Failed to fetch entrepreneurs' });
  }
}

/**
 * Sauvegarde un entrepreneur.
 */
export async function upsertEntrepreneur(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { lot, grappeKey, mode, groupId, entreprise, societe, telephone, email, adresse } =
      req.body;

    if (!organizationId || !lot) {
      return res.status(400).json({ error: 'organizationId and lot required' });
    }

    const effectiveGrappeKey = grappeKey || (groupId ? groupId : null);
    const data = {
      organizationId,
      lot,
      grappeKey: effectiveGrappeKey,
      mode,
      groupId,
      entreprise,
      societe,
      telephone,
      email,
      adresse,
    };

    const entrepreneur = await prisma.cartoEntrepreneur.upsert({
      where: {
        organizationId_lot_grappeKey_entreprise: {
          organizationId,
          lot,
          grappeKey: effectiveGrappeKey,
          entreprise: entreprise || '',
        },
      },
      create: data,
      update: data,
    });

    socketService.emit('carto:updated', { type: 'entrepreneur', id: entrepreneur.id, lot }, `org_${organizationId}`);

    res.json(entrepreneur);
  } catch (err) {
    logger.error('upsertEntrepreneur error:', err);
    res.status(500).json({ error: 'Failed to update entrepreneur' });
  }
}

/**
 * Supprime un entrepreneur.
 */
export async function deleteEntrepreneur(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'entrepreneur id required' });
    }

    await prisma.cartoEntrepreneur.deleteMany({
      where: { organizationId, id },
    });

    socketService.emit('carto:updated', { type: 'entrepreneur', id, deleted: true }, `org_${organizationId}`);

    res.json({ ok: true });
  } catch (err) {
    logger.error('deleteEntrepreneur error:', err);
    res.status(500).json({ error: 'Failed to delete entrepreneur' });
  }
}

/**
 * Récupère les overrides de villages.
 */
export async function getVillageOverrides(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const overrides = await prisma.cartoVillageOverride.findMany({
      where: { organizationId },
    });

    res.json(Object.fromEntries(overrides.map(o => [o.villageKey, o.grappeNumber])));
  } catch (err) {
    logger.error('getVillageOverrides error:', err);
    res.status(500).json({ error: 'Failed to fetch village overrides' });
  }
}

/**
 * Définit un override de village.
 */
export async function setVillageOverride(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { villageKey, grappeNumber } = req.body;
    if (!villageKey || !grappeNumber) {
      return res.status(400).json({ error: 'villageKey and grappeNumber required' });
    }

    const override = await prisma.cartoVillageOverride.upsert({
      where: { organizationId_villageKey: { organizationId, villageKey } },
      create: { organizationId, villageKey, grappeNumber },
      update: { grappeNumber },
    });

    socketService.emit('carto:updated', { type: 'villageOverride', villageKey, grappeNumber }, `org_${organizationId}`);

    res.json(override);
  } catch (err) {
    logger.error('setVillageOverride error:', err);
    res.status(500).json({ error: 'Failed to set village override' });
  }
}

/**
 * Récupère l'historique.
 */
export async function getHistory(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const history = await prisma.cartoHistory.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(history);
  } catch (err) {
    logger.error('getHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}

/**
 * Efface l'historique.
 */
export async function clearHistory(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    await prisma.cartoHistory.deleteMany({ where: { organizationId } });
    socketService.emit('carto:updated', { type: 'history', cleared: true }, `org_${organizationId}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error('clearHistory error:', err);
    res.status(500).json({ error: 'Failed to clear history' });
  }
}

/**
 * Récupère les paramètres de planning.
 */
export async function getPlanningParams(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const params = await prisma.cartoPlanningParams.findUnique({
      where: { organizationId },
    });

    res.json(params?.params || {});
  } catch (err) {
    logger.error('getPlanningParams error:', err);
    res.status(500).json({ error: 'Failed to fetch planning params' });
  }
}

/**
 * Met à jour les paramètres de planning.
 */
export async function updatePlanningParams(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const params = req.body;
    await prisma.cartoPlanningParams.upsert({
      where: { organizationId },
      create: params,
      update: params,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('updatePlanningParams error:', err);
    res.status(500).json({ error: 'Failed to update planning params' });
  }
}

/**
 * Récupère le Gantt.
 */
export async function getGantt(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const entries = await prisma.cartoGantt.findMany({
      where: { organizationId },
    });

    res.json(entries);
  } catch (err) {
    logger.error('getGantt error:', err);
    res.status(500).json({ error: 'Failed to fetch Gantt' });
  }
}

/**
 * Met à jour le Gantt.
 */
export async function upsertGantt(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { grappeKey, phase, startDate, endDate, status } = req.body;
    if (!grappeKey || !phase || !startDate) {
      return res.status(400).json({ error: 'grappeKey, phase and startDate required' });
    }

    const entry = await prisma.cartoGantt.upsert({
      where: { organizationId_grappeKey_phase: { organizationId, grappeKey, phase } },
      create: { organizationId, grappeKey, phase, startDate, endDate, status },
      update: { endDate, status },
    });

    res.json(entry);
  } catch (err) {
    logger.error('upsertGantt error:', err);
    res.status(500).json({ error: 'Failed to update Gantt' });
  }
}

/**
 * Récupère les fiches.
 */
export async function getFiches(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const ficheKey = req.query.ficheKey;
    const where = ficheKey ? { key: ficheKey } : {};

    const fiches = await prisma.cartoFiche.findMany({
      where,
      orderBy: { entryIndex: 'asc' },
    });

    res.json(fiches);
  } catch (err) {
    logger.error('getFiches error:', err);
    res.status(500).json({ error: 'Failed to fetch fiches' });
  }
}

/**
 * Ajoute une entrée de fiche.
 */
export async function addFicheEntry(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { ficheKey, data } = req.body;
    if (!ficheKey || !data) {
      return res.status(400).json({ error: 'ficheKey and data required' });
    }

    const count = await prisma.cartoFiche.count({ where: { key: ficheKey } });
    const entryIndex = count;

    const entry = await prisma.cartoFiche.create({
      data: {
        key: ficheKey,
        entryIndex,
        data,
        author: req.user?.name || 'system',
      },
    });

    res.json(entry);
  } catch (err) {
    logger.error('addFicheEntry error:', err);
    res.status(500).json({ error: 'Failed to add fiche entry' });
  }
}

/**
 * Supprime une entrée de fiche.
 */
export async function deleteFicheEntry(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'fiche entry id required' });
    }

    const entry = await prisma.cartoFiche.findUnique({ where: { id } });
    if (!entry || entry.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Not found' });
    }
    await prisma.cartoFiche.delete({ where: { id } });
    res.json({ success: true, ok: true });
  } catch (err) {
    logger.error('deleteFicheEntry error:', err);
    res.status(500).json({ error: 'Failed to delete fiche entry' });
  }
}

/**
 * Récupère les photos.
 */
export async function getPhoto(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const householdOrdre = req.query.householdOrdre;
    const lot = req.query.lot;
    if (!householdOrdre || !lot) {
      return res.status(400).json({ error: 'householdOrdre and lot required' });
    }

    const photo = await prisma.cartoPhoto.findUnique({
      where: { organizationId_householdOrdre_lot: { organizationId, householdOrdre, lot } },
    });

    res.json(photo || {});
  } catch (err) {
    logger.error('getPhoto error:', err);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
}

/**
 * Sauvegarde une photo.
 */
export async function savePhoto(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const householdOrdre = req.body.householdOrdre;
    const lot = req.body.lot;
    const data = req.body.data;
    if (!householdOrdre || !lot || !data) {
      return res.status(400).json({ error: 'householdOrdre, lot and data required' });
    }

    await prisma.cartoPhoto.upsert({
      where: { organizationId_householdOrdre_lot: { organizationId, householdOrdre, lot } },
      create: { organizationId, householdOrdre, lot, data, userName: req.user?.name || 'system' },
      update: { data, userName: req.user?.name || 'system' },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('savePhoto error:', err);
    res.status(500).json({ error: 'Failed to save photo' });
  }
}

/**
 * Récupère les modèles de contrats.
 */
export async function getContractTemplates(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const templates = await prisma.cartoContractTemplate.findMany({
      where: { organizationId },
    });

    res.json(Object.fromEntries(templates.map(t => [t.lot, t.htmlContent])));
  } catch (err) {
    logger.error('getContractTemplates error:', err);
    res.status(500).json({ error: 'Failed to fetch contract templates' });
  }
}

/**
 * Sauvegarde un modèle de contrat.
 */
export async function saveContractTemplate(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { lot, htmlContent } = req.body;
    if (!lot || !htmlContent) {
      return res.status(400).json({ error: 'lot and htmlContent required' });
    }

    await prisma.cartoContractTemplate.upsert({
      where: { organizationId_lot: { organizationId, lot } },
      create: { organizationId, lot, htmlContent },
      update: { htmlContent },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('saveContractTemplate error:', err);
    res.status(500).json({ error: 'Failed to save contract template' });
  }
}

/**
 * Récupère les villages.
 */
/**
 * Récupère les villages (agrégés depuis les ménages unifiés).
 */
export async function getVillages(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const villages = await prisma.$queryRaw(
      Prisma.sql`SELECT region, village, COUNT(*) as n, AVG(latitude) as lat, AVG(longitude) as lon FROM "Household" WHERE "organizationId" = ${organizationId} AND village IS NOT NULL GROUP BY region, village`
    );

    res.json(villages);
  } catch (err) {
    logger.error('getVillages error:', err);
    res.status(500).json({ error: 'Failed to fetch villages' });
  }
}

/**
 * Récupère les ménages.
 */
export async function getMenages(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const menages = await prisma.$queryRaw(
      Prisma.sql`SELECT numeroordre as ordre, name as nom, phone as tel, village, departement as commune, region FROM "Household" WHERE "organizationId" = ${organizationId}`
    );

    res.json(menages);
  } catch (err) {
    logger.error('getMenages error:', err);
    res.status(500).json({ error: 'Failed to fetch menages' });
  }
}

/**
 * Récupère les données GPS.
 */
export async function getGps(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const gps = await prisma.$queryRaw(
      Prisma.sql`SELECT numeroordre as ordre, latitude as lat, longitude as lon, 5 as accuracy FROM "Household" WHERE "organizationId" = ${organizationId} AND latitude IS NOT NULL`
    );

    res.json(gps);
  } catch (err) {
    logger.error('getGps error:', err);
    res.status(500).json({ error: 'Failed to fetch GPS data' });
  }
}

/**
 * Récupère les prestataires.
 */
export async function getPrestataires(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const prestataires = await prisma.$queryRaw(
      Prisma.sql`SELECT id, nom, entreprise, societe, telephone, email, adresse, lot, region FROM "Prestataire" WHERE "organizationId" = ${organizationId}`
    );

    res.json(prestataires);
  } catch (err) {
    logger.error('getPrestataires error:', err);
    res.status(500).json({ error: 'Failed to fetch prestataires' });
  }
}

/**
 * Met à jour les prestataires en masse.
 */
export async function upsertPrestataires(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const prestataires = req.body.prestataires;
    if (!prestataires || !Array.isArray(prestataires)) {
      return res.status(400).json({ error: 'prestataires array required' });
    }

    if (prestataires.length > 0) {
      for (const p of prestataires) {
        await prisma.$executeRaw(
          Prisma.sql`INSERT INTO "Prestataire" (nom, entreprise, societe, telephone, email, adresse, lot, region, "organizationId") VALUES (${p.nom || ''}, ${p.entreprise || ''}, ${p.societe || ''}, ${p.telephone || ''}, ${p.email || ''}, ${p.adresse || ''}, ${p.lot || ''}, ${p.region || ''}, ${organizationId}) ON CONFLICT ("organizationId", nom) DO UPDATE SET entreprise = EXCLUDED.entreprise, societe = EXCLUDED.societe, telephone = EXCLUDED.telephone, email = EXCLUDED.email, adresse = EXCLUDED.adresse, lot = EXCLUDED.lot, region = EXCLUDED.region`
        );
      }
    }

    res.json({ total: prestataires.length, ok: true });
  } catch (err) {
    logger.error('upsertPrestataires error:', err);
    res.status(500).json({ error: 'Failed to upsert prestataires' });
  }
}

/**
 * Met à jour un prestataire.
 */
export async function updatePrestataire(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const id = req.params.id;
    const { nom, entreprise, societe, telephone, email, adresse, lot, region } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'prestataire id required' });
    }

    const result = await prisma.prestataire.update({
      where: { id },
      data: {
        nom,
        entreprise,
        societe,
        telephone,
        email,
        adresse,
        lot,
        region,
      },
    });

    res.json(result);
  } catch (err) {
    logger.error('updatePrestataire error:', err);
    res.status(500).json({ error: 'Failed to update prestataire' });
  }
}

/**
 * Supprime un prestataire.
 */
export async function deletePrestataire(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'prestataire id required' });
    }

    await prisma.prestataire.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    logger.error('deletePrestataire error:', err);
    res.status(500).json({ error: 'Failed to delete prestataire' });
  }
}

/**
 * Récupère la configuration des alertes.
 */
export async function getAlertsConfig(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    let config = await prisma.cartoAlerts.findUnique({
      where: { organizationId },
    });

    if (!config) {
      config = {
        organizationId,
        delayDays: 7,
        enabled: true,
        dismissed: false,
      };
      await prisma.cartoAlerts.create({ data: config });
    }

    res.json(config);
  } catch (err) {
    logger.error('getAlertsConfig error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts config' });
  }
}

/**
 * Met à jour la configuration des alertes.
 */
export async function updateAlertsConfig(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const { delayDays, enabled, dismissed } = req.body;
    if (delayDays === undefined && enabled === undefined && dismissed === undefined) {
      return res.status(400).json({ error: 'At least one config field required' });
    }

    await prisma.cartoAlerts.upsert({
      where: { organizationId },
      create: {
        organizationId,
        delayDays: delayDays ?? 7,
        enabled: enabled ?? true,
        dismissed: dismissed ?? false,
      },
      update: {
        delayDays: delayDays,
        enabled: enabled,
        dismissed: dismissed,
      },
    });

    socketService.emit('carto:updated', { type: 'alertsConfig' }, `org_${organizationId}`);

    res.json({ success: true });
  } catch (err) {
    logger.error('updateAlertsConfig error:', err);
    res.status(500).json({ error: 'Failed to update alerts config' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Secondary Features - Stub Implementations (return empty/default responses)
// These are kept for API compatibility but not yet fully migrated to unified DB
// ═══════════════════════════════════════════════════════════════════════════════

/** Workflow queue - returns pending workflows */
export async function getWorkflowQueue(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });
    const workflows = await prisma.cartoWorkflow.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(workflows);
  } catch (err) {
    logger.error('getWorkflowQueue error:', err);
    res.status(500).json({ error: 'Failed to fetch workflow queue' });
  }
}

/** Submit workflow - creates a new workflow entry */
export async function submitWorkflow(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });
    const { householdOrdre, nom, village, region, grappe, statuts } = req.body;
    const workflow = await prisma.cartoWorkflow.create({
      data: {
        organizationId,
        householdOrdre: parseInt(householdOrdre, 10) || 0,
        nom: nom || '',
        village: village || '',
        region: region || '',
        grappe: parseInt(grappe, 10) || 0,
        submittedBy: req.user?.id || req.user?.email || 'system',
        status: 'pending',
        statuts: statuts || {},
      },
    });
    res.json({ success: true, id: workflow.id });
  } catch (err) {
    logger.error('submitWorkflow error:', err);
    res.status(500).json({ error: 'Failed to submit workflow' });
  }
}

/** Approve workflow - updates workflow status */
export async function approveWorkflow(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });
    const id = req.params.id;
    const workflow = await prisma.cartoWorkflow.update({
      where: { id },
      data: { status: 'approved' },
    });
    res.json({ success: true, workflow });
  } catch (err) {
    logger.error('approveWorkflow error:', err);
    res.status(500).json({ error: 'Failed to approve workflow' });
  }
}

/** Archives - returns list of archives */
export async function getArchives(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });
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

/** Create archive - stores a new archive */
export async function createArchive(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });
    const { grappeKey, region, grappe, totalMenages, totalConformes, snapshot } = req.body;
    const archive = await prisma.cartoArchive.create({
      data: {
        organizationId,
        grappeKey: grappeKey || '',
        archivedBy: req.user?.id || req.user?.email || 'system',
        region: region || '',
        grappe: parseInt(grappe, 10) || 0,
        totalMenages: parseInt(totalMenages, 10) || 0,
        totalConformes: parseInt(totalConformes, 10) || 0,
        snapshot: snapshot || {},
      },
    });
    res.json({ success: true, id: archive.id });
  } catch (err) {
    logger.error('createArchive error:', err);
    res.status(500).json({ error: 'Failed to create archive' });
  }
}

/** Stats snapshots - returns list */
export async function getStatsSnapshots(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });
    const snapshots = await prisma.cartoStatsSnapshot.findMany({
      where: { organizationId },
      orderBy: { snapshotDate: 'desc' },
    });
    res.json(snapshots);
  } catch (err) {
    logger.error('getStatsSnapshots error:', err);
    res.status(500).json({ error: 'Failed to fetch stats snapshots' });
  }
}

/** Create stats snapshot - upserts a snapshot */
export async function createStatsSnapshot(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });
    const { conforme, lotA, lotB, lotC, bloques, snapshotDate } = req.body;
    const date = snapshotDate || new Date().toISOString().slice(0, 10);
    const snapshot = await prisma.cartoStatsSnapshot.upsert({
      where: { organizationId_snapshotDate: { organizationId, snapshotDate: date } },
      create: {
        organizationId,
        snapshotDate: date,
        conforme: parseInt(conforme, 10) || 0,
        lotA: parseInt(lotA, 10) || 0,
        lotB: parseInt(lotB, 10) || 0,
        lotC: parseInt(lotC, 10) || 0,
        bloques: parseInt(bloques, 10) || 0,
      },
      update: {
        conforme: parseInt(conforme, 10) || 0,
        lotA: parseInt(lotA, 10) || 0,
        lotB: parseInt(lotB, 10) || 0,
        lotC: parseInt(lotC, 10) || 0,
        bloques: parseInt(bloques, 10) || 0,
      },
    });
    res.json({ success: true, snapshot });
  } catch (err) {
    logger.error('createStatsSnapshot error:', err);
    res.status(500).json({ error: 'Failed to create stats snapshot' });
  }
}

/** Settings - returns org settings or creates default */
export async function getSettings(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    let settings = await prisma.cartoSettings.findUnique({ where: { organizationId } });
    if (!settings) {
      settings = await prisma.cartoSettings.create({
        data: { organizationId, bareme: {}, lotLabels: {}, featureToggles: {} },
      });
    }
    res.json(settings);
  } catch (err) {
    logger.error('getSettings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
}

export async function updateSettings(req, res) {
  try {
    const organizationId = getOrgId(req);
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const settings = await prisma.cartoSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...req.body },
      update: req.body,
    });
    socketService.emit('carto:updated', { type: 'settings' }, `org_${organizationId}`);
    res.json(settings);
  } catch (err) {
    logger.error('updateSettings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
}
