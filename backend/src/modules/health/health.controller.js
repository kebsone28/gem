import prisma from '../../core/utils/prisma.js';
import { HealthService } from '../../services/domain/HealthService.js';
import { DomainAdapterFactory } from '../../domain-adapters/DomainAdapterFactory.js';

export const getHealthCenters = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, status, type } = req.query;

    const adapter = DomainAdapterFactory.getAdapter('health');
    const shape = adapter.getOptimalQueryShape();

    const where = { organizationId };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const centers = await prisma.healthCenter.findMany({
      where,
      ...shape
    });

    let result = centers;
    if (type) {
      result = centers.filter(c => c.domainData?.type?.toLowerCase() === type.toLowerCase());
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHealthCenterById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const center = await prisma.healthCenter.findFirst({
      where: { id, organizationId }
    });

    if (!center) return res.status(404).json({ error: 'Health Center not found' });

    res.status(200).json(center);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createHealthCenter = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, ...rawData } = req.body;

    const center = await HealthService.createHealthCenter(organizationId, projectId, rawData);

    res.status(201).json(center);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getCampaigns = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, status } = req.query;

    const where = { organizationId };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const campaigns = await prisma.campaign.findMany({
      where
    });

    res.status(200).json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId }
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    res.status(200).json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createCampaign = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, ...rawData } = req.body;

    const campaign = await HealthService.createCampaign(organizationId, projectId, rawData);

    res.status(201).json(campaign);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
