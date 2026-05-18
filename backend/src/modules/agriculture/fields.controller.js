import prisma from '../../core/utils/prisma.js';
import { AgricultureService } from '../../services/domain/AgricultureService.js';
import { DomainAdapterFactory } from '../../domain-adapters/DomainAdapterFactory.js';
import eventBus from '../../core/utils/eventBus.js';

export const getFields = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, status, cropType } = req.query;

    const adapter = DomainAdapterFactory.getAdapter('agriculture');
    const shape = adapter.getOptimalQueryShape();

    const where = { organizationId };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    // For json fields, Prisma requires raw queries or path filtering which can be complex
    // So we fetch and filter in memory if cropType is provided (for this pilot)

    const fields = await prisma.field.findMany({
      where,
      ...shape
    });

    let result = fields;
    if (cropType) {
      result = fields.filter(f => f.domainData?.cropType?.toLowerCase() === cropType.toLowerCase());
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFieldById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const field = await prisma.field.findFirst({
      where: { id, organizationId }
    });

    if (!field) return res.status(404).json({ error: 'Field not found' });

    res.status(200).json(field);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createField = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, ...rawData } = req.body;

    const field = await AgricultureService.createField(organizationId, projectId, rawData);

    res.status(201).json(field);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getFieldAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const field = await prisma.field.findFirst({
      where: { id, organizationId }
    });

    if (!field) return res.status(404).json({ error: 'Field not found' });

    const yieldPrediction = await AgricultureService.calculatePredictedYield(id);
    const waterReq = await AgricultureService.calculateWaterRequirements(id);
    const rotation = await AgricultureService.getCropRotationRecommendations(id);
    const fertilizer = await AgricultureService.calculateFertilizerNeeds(id);
    const pestRisk = await AgricultureService.assessDiseaseRisk(id);

    res.status(200).json({
      fieldId: id,
      yieldPrediction,
      waterRequirements: waterReq,
      cropRotation: rotation,
      fertilizerNeeds: fertilizer,
      pestAndDiseaseRisk: pestRisk
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
