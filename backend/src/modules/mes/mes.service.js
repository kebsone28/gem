import logger from '../../utils/logger.js';
import prisma from '../../core/utils/prisma.js';
import * as XLSX from 'xlsx';

class MESService {
  /**
   * Récupérer tous les enregistrements MES avec filtres
   */
  async getMESRecords(filters = {}, organizationId) {
    const where = {
      organizationId,
      deletedAt: null,
    };

    if (filters.prestataire && filters.prestataire !== 'ALL') {
      where.prestataire = filters.prestataire;
    }

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters.month) {
      const [year, month] = filters.month.split('-');
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (filters.searchQuery) {
      where.OR = [
        { avisNumber: { contains: filters.searchQuery, mode: 'insensitive' } },
        { meterNumber: { contains: filters.searchQuery, mode: 'insensitive' } },
        { zone: { contains: filters.searchQuery, mode: 'insensitive' } },
      ];
    }

    if (filters.zone) {
      where.zone = filters.zone;
    }

    if (filters.poste) {
      where.poste = filters.poste;
    }

    const records = await prisma.mESRecord.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return records;
  }

  /**
   * Récupérer un enregistrement MES par ID
   */
  async getMESRecordById(id, organizationId) {
    return await prisma.mESRecord.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        controls: true,
        controller: {
          select: { id: true, name: true, email: true },
        },
        validator: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Créer un nouvel enregistrement MES
   */
  async createMESRecord(data, organizationId, userId) {
    return await prisma.mESRecord.create({
      data: {
        ...data,
        organizationId,
        status: data.status || 'RECU',
        date: data.date ? new Date(data.date) : new Date(),
      },
    });
  }

  /**
   * Mettre à jour un enregistrement MES
   */
  async updateMESRecord(id, data, organizationId, userId) {
    return await prisma.mESRecord.update({
      where: {
        id,
        organizationId,
      },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Supprimer un enregistrement MES (soft delete)
   */
  async deleteMESRecord(id, organizationId) {
    return await prisma.mESRecord.update({
      where: {
        id,
        organizationId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Mettre à jour le statut d'un enregistrement MES
   */
  async updateMESStatus(id, status, organizationId, userId) {
    return await prisma.mESRecord.update({
      where: {
        id,
        organizationId,
      },
      data: {
        status,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Valider un enregistrement MES
   */
  async validateMESRecord(id, validatorId, organizationId) {
    return await prisma.mESRecord.update({
      where: {
        id,
        organizationId,
      },
      data: {
        validated: true,
        validatorId,
        validationDate: new Date(),
        status: 'VALIDE',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Contrôler un enregistrement MES
   */
  async controlMESRecord(id, controllerId, checklist, organizationId) {
    // Créer le contrôle
    const control = await prisma.mESControl.create({
      data: {
        mesRecordId: id,
        controllerId,
        ...checklist,
        conforme: Object.values(checklist).every(v => v === true),
      },
    });

    // Mettre à jour l'enregistrement MES
    await prisma.mESRecord.update({
      where: {
        id,
        organizationId,
      },
      data: {
        controlled: true,
        controllerId,
        controlDate: new Date(),
        status: control.conforme ? 'CONTROLE' : 'REALISE',
        checklist,
        updatedAt: new Date(),
      },
    });

    return await this.getMESRecordById(id, organizationId);
  }

  /**
   * Récupérer les statistiques MES
   */
  async getMESStats(filters = {}, organizationId) {
    const where = {
      organizationId,
      deletedAt: null,
    };

    if (filters.month) {
      const [year, month] = filters.month.split('-');
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (filters.prestataire && filters.prestataire !== 'ALL') {
      where.prestataire = filters.prestataire;
    }

    const records = await prisma.mESRecord.findMany({ where });

    const stats = {
      total: records.length,
      poseMono: records.filter(r => r.type === 'MONO' && r.nature === 'POSE').length,
      poseTri: records.filter(r => r.type === 'TRI' && r.nature === 'POSE').length,
      branchementPoseMono: records.filter(r => r.type === 'MONO' && r.nature === 'BRANCHEMENT_POSE').length,
      branchementPoseTri: records.filter(r => r.type === 'TRI' && r.nature === 'BRANCHEMENT_POSE').length,
      enCours: records.filter(r => r.status === 'EN_COURS').length,
      realises: records.filter(r => r.status === 'REALISE').length,
      controles: records.filter(r => r.status === 'CONTROLE').length,
      valides: records.filter(r => r.status === 'VALIDE').length,
      tauxConformite: records.length > 0 ? (records.filter(r => r.status === 'VALIDE').length / records.length) * 100 : 0,
    };

    return stats;
  }

  /**
   * Importer des données depuis Excel
   */
  async importFromExcel(file, organizationId, userId) {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let imported = 0;
      let errors = 0;
      const details = [];

      for (const row of jsonData) {
        try {
          await prisma.mESRecord.create({
            data: {
              organizationId,
              avisNumber: row['Avis'] || row['avis'],
              meterNumber: row['Compteur'] || row['compteur'],
              poste: row['Poste'] || row['poste'] || '',
              zone: row['Zone'] || row['zone'] || '',
              type: row['Type'] || row['type'] || 'MONO',
              nature: this.mapNature(row['Nature'] || row['nature']),
              cable: row['Cable'] || row['cable'],
              ct70: row['CT70'] === true || row['ct70'] === true,
              pa: row['PA'] === true || row['pa'] === true,
              agent: row['Agent'] || row['agent'] || '',
              date: row['Date'] ? new Date(row['Date']) : new Date(),
              observations: row['Observations'] || row['observations'],
              status: 'REALISE',
              prestataire: row['Prestataire'] || row['prestataire'] || 'AUTRE',
            },
          });
          imported++;
        } catch (error) {
          errors++;
          details.push(`Erreur pour l'avis ${row['Avis']}: ${error.message}`);
        }
      }

      return {
        success: true,
        imported,
        errors,
        details,
      };
    } catch (error) {
      logger.error('[MESService] Error importing from Excel:', error);
      throw error;
    }
  }

  /**
   * Mapper la nature depuis Excel
   */
  mapNature(nature) {
    if (!nature) return 'POSE';
    const normalized = nature.toString().toLowerCase();
    if (normalized.includes('branchement')) {
      return 'BRANCHEMENT_POSE';
    }
    return 'POSE';
  }

  /**
   * Exporter des données vers Excel
   */
  async exportToExcel(filters = {}, organizationId) {
    const records = await this.getMESRecords(filters, organizationId);

    const data = records.map(r => ({
      Avis: r.avisNumber,
      Compteur: r.meterNumber,
      Poste: r.poste,
      Zone: r.zone,
      Type: r.type,
      Nature: r.nature === 'BRANCHEMENT_POSE' ? 'Branchement + Pose' : 'Pose',
      Cable: r.cable,
      CT70: r.ct70 ? 'Oui' : 'Non',
      PA: r.pa ? 'Oui' : 'Non',
      Agent: r.agent,
      Date: r.date,
      Observations: r.observations,
      Statut: r.status,
      Prestataire: r.prestataire,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MES');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Récupérer les zones disponibles
   */
  async getZones(organizationId) {
    const records = await prisma.mESRecord.findMany({
      where: { organizationId, deletedAt: null },
      select: { zone: true },
      distinct: ['zone'],
    });

    return records.map(r => r.zone).filter(Boolean);
  }

  /**
   * Récupérer les postes disponibles
   */
  async getPostes(organizationId) {
    const records = await prisma.mESRecord.findMany({
      where: { organizationId, deletedAt: null },
      select: { poste: true },
      distinct: ['poste'],
    });

    return records.map(r => r.poste).filter(Boolean);
  }

  /**
   * Récupérer les agents disponibles
   */
  async getAgents(organizationId, prestataire) {
    const where = {
      organizationId,
      deletedAt: null,
    };

    if (prestataire && prestataire !== 'ALL') {
      where.prestataire = prestataire;
    }

    const records = await prisma.mESRecord.findMany({
      where,
      select: { agent: true },
      distinct: ['agent'],
    });

    return records.map(r => r.agent).filter(Boolean);
  }
}

export const mesService = new MESService();
export default mesService;
