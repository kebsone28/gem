import prisma from '../../core/utils/prisma.js';
import { LogisticsService } from '../../services/domain/LogisticsService.js';
import { DomainAdapterFactory } from '../../domain-adapters/DomainAdapterFactory.js';

export const getWarehouses = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, status } = req.query;

    const adapter = DomainAdapterFactory.getAdapter('gem');
    const shape = adapter.getOptimalQueryShape();

    const where = { organizationId };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const warehouses = await prisma.warehouse.findMany({
      where,
      ...shape
    });

    res.status(200).json(warehouses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getWarehouseById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const warehouse = await prisma.warehouse.findFirst({
      where: { id, organizationId }
    });

    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });

    res.status(200).json(warehouse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createWarehouse = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, ...rawData } = req.body;

    const warehouse = await LogisticsService.createWarehouse(organizationId, projectId, rawData);

    res.status(201).json(warehouse);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getShipments = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, status } = req.query;

    const where = { organizationId };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const shipments = await prisma.shipment.findMany({
      where
    });

    res.status(200).json(shipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getShipmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const shipment = await prisma.shipment.findFirst({
      where: { id, organizationId }
    });

    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    res.status(200).json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createShipment = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { projectId, ...rawData } = req.body;

    const shipment = await LogisticsService.createShipment(organizationId, projectId, rawData);

    res.status(201).json(shipment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
